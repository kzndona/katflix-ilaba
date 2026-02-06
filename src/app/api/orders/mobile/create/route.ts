/**
 * POST /api/orders/mobile/create
 * 
 * Mobile App Order Creation
 * - Creates/updates customer (if needed)
 * - Creates order with breakdown and handling JSONB
 * - Deducts product inventory
 * - Awards loyalty points
 * 
 * Similar to POS but:
 * - NO cashier_id (mobile orders are self-service)
 * - source='mobile'
 * - Can be called without authentication (optional)
 * - Customer data is required (mobile must provide customer info)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

interface CreateMobileOrderRequest {
  customer_data: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
  };
  breakdown: any; // OrderBreakdown JSONB
  handling: any; // OrderHandling JSONB (includes scheduling: scheduled, scheduled_date, scheduled_time)
  gcash_receipt_url?: string; // Optional GCash receipt image URL
  loyalty?: {
    discount_tier: null | 'tier1' | 'tier2';
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    // === PARSE REQUEST ===
    const body: CreateMobileOrderRequest = await request.json();

    // === DEBUG LOG ===
    console.log("[MOBILE ORDER] Request payload:", JSON.stringify(body, null, 2));
    console.log("[MOBILE ORDER] gcash_receipt_url:", body.gcash_receipt_url);

    // === HELPER: Enrich services with pricing snapshots ===
    async function enrichServicesWithPricing(breakdown: any) {
      if (!breakdown.baskets || !Array.isArray(breakdown.baskets)) {
        return breakdown;
      }

      // Fetch all active services from database
      const { data: allServices, error: servicesError } = await supabase
        .from("services")
        .select("service_type, tier, name, base_price");

      if (servicesError || !allServices) {
        console.warn("Failed to fetch services for pricing snapshot:", servicesError);
        return breakdown; // Return unchanged if fetch fails
      }

      // Build pricing map: service_type + tier -> pricing info
      const pricingMap: Record<string, any> = {};
      for (const service of allServices) {
        const key = `${service.service_type}:${service.tier || "null"}`;
        pricingMap[key] = {
          base_price: service.base_price,
          service_type: service.service_type,
          name: service.name,
          tier: service.tier,
        };
      }

      // Enrich each basket's services object with pricing snapshots
      const enrichedBreakdown = {
        ...breakdown,
        baskets: breakdown.baskets.map((basket: any) => {
          const services = basket.services || {};
          const enrichedServices = { ...services };

          // Add pricing snapshot for each service type
          // WASH
          if (services.wash && services.wash !== "off") {
            const pricingKey = `wash:${services.wash}`;
            enrichedServices.wash_pricing = pricingMap[pricingKey] || {};
          }

          // DRY
          if (services.dry && services.dry !== "off") {
            const pricingKey = `dry:${services.dry}`;
            enrichedServices.dry_pricing = pricingMap[pricingKey] || {};
          }

          // SPIN
          if (services.spin) {
            const pricingKey = `spin:null`;
            enrichedServices.spin_pricing = pricingMap[pricingKey] || {};
          }

          // IRON
          if (services.iron_weight_kg && services.iron_weight_kg > 0) {
            const pricingKey = `iron:null`;
            enrichedServices.iron_pricing = pricingMap[pricingKey] || {};
          }

          // STAFF SERVICE (fee is per-order, add to summary but note it in services)
          enrichedServices.staff_service_pricing = pricingMap["staff_service:null"] || {};

          return {
            ...basket,
            services: enrichedServices,
          };
        }),
      };

      return enrichedBreakdown;
    }

    // === VALIDATE INPUT ===
    if (!body.breakdown) {
      return NextResponse.json(
        { success: false, error: "Missing breakdown data" },
        { status: 400 }
      );
    }

    // === BUILD HANDLING STRUCTURE ===
    // For mobile orders, both pickup and delivery addresses must be provided
    // IMPORTANT: Both pickup and delivery require LAT/LNG coordinates
    const handling = {
      pickup: {
        address: body.handling?.pickup_address || "",
        lng: body.handling?.pickup_lng || null,
        lat: body.handling?.pickup_lat || null,
        status: "pending" as const,
        started_at: null,
        completed_at: null,
      },
      delivery: {
        address: body.handling?.delivery_address || "",
        lng: body.handling?.delivery_lng || null,
        lat: body.handling?.delivery_lat || null,
        status: "pending" as const,
        started_at: null,
        completed_at: null,
      },
      // Include payment info if provided
      payment_method: body.handling?.payment_method || null,
      amount_paid: body.handling?.amount_paid || null,
      // Include scheduling info if provided (mapped from POS)
      scheduled: body.handling?.scheduled || false,
      scheduled_date: body.handling?.scheduled_date || undefined,
      scheduled_time: body.handling?.scheduled_time || undefined,
    };

    // Replace body.handling with the properly structured version
    body.handling = handling;

    // Customer data is required for mobile orders
    if (!body.customer_data) {
      return NextResponse.json(
        { success: false, error: "Customer data required for mobile orders" },
        { status: 400 }
      );
    }

    if (
      !body.customer_data.first_name?.trim() ||
      !body.customer_data.last_name?.trim() ||
      !body.customer_data.phone_number?.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Customer first/last name and phone required" },
        { status: 400 }
      );
    }

    // Validate baskets have services object
    if (body.breakdown.baskets && Array.isArray(body.breakdown.baskets)) {
      for (let i = 0; i < body.breakdown.baskets.length; i++) {
        const basket = body.breakdown.baskets[i];
        if (!basket.services || typeof basket.services !== "object" || Array.isArray(basket.services)) {
          return NextResponse.json(
            { success: false, error: `Basket ${i + 1} missing services object` },
            { status: 400 }
          );
        }
      }
    }

    // === STEP 1: Create or get customer ===
    // First check if customer exists by phone number
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone_number", body.customer_data.phone_number)
      .single();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          first_name: body.customer_data.first_name,
          last_name: body.customer_data.last_name,
          phone_number: body.customer_data.phone_number,
          email_address: body.customer_data.email || null,
          loyalty_points: 0,
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        console.error("Customer creation error:", customerError);
        return NextResponse.json(
          { success: false, error: "Failed to create customer" },
          { status: 500 }
        );
      }

      customerId = newCustomer.id;
    }

    // === STEP 2: Validate inventory and handle plastic bags ===
    const itemsToValidate = [...(body.breakdown.items || [])];
    
    // Collect plastic bags from all baskets
    if (body.breakdown.baskets && Array.isArray(body.breakdown.baskets)) {
      const totalPlasticBags = body.breakdown.baskets.reduce(
        (sum: number, basket: any) => sum + (basket.services?.plastic_bags || 0),
        0
      );
      
      if (totalPlasticBags > 0) {
        // Find or create plastic bag product entry
        const plasticBagIndex = itemsToValidate.findIndex(
          (item: any) => item.product_name?.toLowerCase().includes("plastic") || item.product_name?.toLowerCase().includes("bag")
        );
        
        if (plasticBagIndex >= 0) {
          // Update existing plastic bag entry
          itemsToValidate[plasticBagIndex].quantity = totalPlasticBags;
        } else {
          // Need to find plastic bag product ID from database
          const { data: plasticBagProduct, error: pbError } = await supabase
            .from("products")
            .select("id")
            .or("item_name.ilike.%plastic%,item_name.ilike.%bag%")
            .limit(1)
            .single();
          
          if (pbError || !plasticBagProduct) {
            // Create plastic bag product if it doesn't exist
            const { data: newBagProduct, error: createBagError } = await supabase
              .from("products")
              .insert({
                item_name: "Plastic Bags",
                unit_price: 0.50,
                quantity: 1000, // Stock a large quantity
                is_active: true,
              })
              .select("id")
              .single();
            
            if (createBagError || !newBagProduct) {
              console.error("Failed to create plastic bag product:", createBagError);
              return NextResponse.json(
                { success: false, error: "Failed to create plastic bag product" },
                { status: 500 }
              );
            }
            
            itemsToValidate.push({
              product_id: newBagProduct.id,
              product_name: "Plastic Bags",
              unit_price: 0.50,
              quantity: totalPlasticBags,
              subtotal: totalPlasticBags * 0.50,
            });
          } else {
            itemsToValidate.push({
              product_id: plasticBagProduct.id,
              product_name: "Plastic Bags",
              unit_price: 0.50,
              quantity: totalPlasticBags,
              subtotal: totalPlasticBags * 0.50,
            });
          }
        }
      }
    }

    // Now validate all items (including plastic bags)
    for (const item of itemsToValidate) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("quantity")
        .eq("id", item.product_id)
        .single();

      if (productError || !product) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ${item.product_id} not found`,
          },
          { status: 404 }
        );
      }

      if (product.quantity < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for product ${item.product_id}. Available: ${product.quantity}, Requested: ${item.quantity}`,
          },
          { status: 402 }
        );
      }
    }
    
    // Update breakdown items to include plastic bags
    body.breakdown.items = itemsToValidate;

    // === STEP 2A: Enrich services with pricing snapshots ===
    body.breakdown = await enrichServicesWithPricing(body.breakdown);

    // === STEP 3: Create order (mobile: no cashier_id, source='mobile') ===
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        cashier_id: null, // Mobile orders have no cashier
        source: "mobile", // Mark as mobile order
        breakdown: body.breakdown,
        handling: body.handling,
        gcash_receipt_url: body.gcash_receipt_url || null,
        status: "pending",
        total_amount: body.breakdown.summary.total,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    console.log("[MOBILE ORDER] Order insert payload:", {
      customer_id: customerId,
      source: "mobile",
      gcash_receipt_url: body.gcash_receipt_url || null,
      status: "pending",
      total_amount: body.breakdown.summary.total,
    });

    if (orderError || !newOrder) {
      console.error("Order creation error:", orderError);
      return NextResponse.json(
        { success: false, error: "Failed to create order" },
        { status: 500 }
      );
    }

    const orderId = newOrder.id;

    // === STEP 4: Deduct inventory (product_transactions) ===
    for (const item of itemsToValidate) {
      // 4a. Create product transaction record
      const { error: txError } = await supabase
        .from("product_transactions")
        .insert({
          product_id: item.product_id,
          order_id: orderId,
          quantity_change: -item.quantity, // Negative = deduction
          transaction_type: "order",
          notes: `Mobile order ${orderId}`,
          created_at: new Date().toISOString(),
        });

      if (txError) {
        console.error("Transaction error:", txError);
        // Rollback order creation if transaction fails
        await supabase.from("orders").delete().eq("id", orderId);
        return NextResponse.json(
          { success: false, error: "Failed to create inventory transaction" },
          { status: 500 }
        );
      }

      // 4b. Get current quantity before updating
      const { data: currentProduct, error: getError } = await supabase
        .from("products")
        .select("quantity")
        .eq("id", item.product_id)
        .single();

      if (getError || !currentProduct) {
        console.error("Failed to fetch current product quantity:", getError);
        // Rollback order creation
        await supabase.from("orders").delete().eq("id", orderId);
        return NextResponse.json(
          { success: false, error: "Failed to update inventory" },
          { status: 500 }
        );
      }

      // 4c. Update product stock
      const newQuantity = currentProduct.quantity - item.quantity;
      const { error: updateError } = await supabase
        .from("products")
        .update({ quantity: newQuantity })
        .eq("id", item.product_id);

      if (updateError) {
        console.error("Failed to update product quantity:", updateError);
        // Rollback order creation
        await supabase.from("orders").delete().eq("id", orderId);
        return NextResponse.json(
          { success: false, error: "Failed to update product inventory" },
          { status: 500 }
        );
      }
    }

    // === STEP 5: Award or deduct loyalty points ===
    const discountTier = body.loyalty?.discount_tier || null;
    
    if (discountTier) {
      // Customer is using loyalty discount - deduct points
      let pointsToDeduct = 0;
      if (discountTier === 'tier1') pointsToDeduct = 10;  // 10 points for 5% discount
      if (discountTier === 'tier2') pointsToDeduct = 20;  // 20 points for 15% discount
      
      if (pointsToDeduct > 0) {
        const { data: currentCustomer } = await supabase
          .from("customers")
          .select("loyalty_points")
          .eq("id", customerId)
          .single();
        
        if (currentCustomer) {
          const newPoints = Math.max(0, (currentCustomer.loyalty_points || 0) - pointsToDeduct);
          const { error: updateError } = await supabase
            .from("customers")
            .update({ loyalty_points: newPoints })
            .eq("id", customerId);
          
          if (updateError) {
            console.error("Failed to deduct loyalty points:", updateError);
          }
        }
      }
    } else {
      // Customer is NOT using loyalty discount - award 1 point per completed order
      const { data: currentCustomer } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", customerId)
        .single();
      
      if (currentCustomer) {
        const newPoints = (currentCustomer.loyalty_points || 0) + 1;
        const { error: updateError } = await supabase
          .from("customers")
          .update({ loyalty_points: newPoints })
          .eq("id", customerId);
        
        if (updateError) {
          console.error("Failed to award loyalty points:", updateError);
        }
      }
    }

    // === STEP 6: Generate receipt data ===
    const receiptData = {
      order_id: orderId,
      customer_name: `${body.customer_data.first_name} ${body.customer_data.last_name}`.trim(),
      items: body.breakdown.items || [],
      baskets: body.breakdown.baskets || [],
      total: body.breakdown.summary.total,
      payment_method: body.handling.payment_method,
      change:
        body.handling.payment_method === "cash"
          ? body.handling.amount_paid - body.breakdown.summary.total
          : undefined,
    };

    // === SUCCESS ===
    return NextResponse.json(
      {
        success: true,
        order_id: orderId,
        receipt: receiptData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Mobile create order error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}
