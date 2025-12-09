// app/api/pos/newOrder/route.ts
// 
// Order creation endpoint used by both POS (staff) and mobile (customer) booking
//
// KEY BEHAVIOR FOR MOBILE:
// - Orders with ONLY products (baskets.length === 0) are automatically marked as "completed"
// - Orders with baskets are marked as "processing" (requires laundry service to complete)
// - Empty baskets (weight === 0) should be filtered on client-side before sending
//
// INVENTORY MANAGEMENT:
// - Product quantities are automatically deducted when order is created
// - Validates sufficient stock before deducting
// - Updates product.last_updated timestamp
// - Inventory is restored when order is deleted (see removeOrder endpoint)
//
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface ServicePayload {
  service_id: string;
  rate: number;
  subtotal: number;
}

interface BasketPayload {
  machine_id?: string | null;
  weight?: number;
  notes?: string | null;
  subtotal: number;
  services?: ServicePayload[];
}

interface ProductPayload {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentPayload {
  amount: number;
  method: string;
  reference?: string;
}

interface OrderPayload {
  customerId: string | null;
  total: number;
  baskets: BasketPayload[]; // Empty array for product-only orders (will auto-complete)
  products: ProductPayload[];
  payments?: PaymentPayload[];
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  shippingFee?: number;
  source?: "pos" | "mobile"; // Track source (defaults to 'mobile' for this endpoint)
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const body: OrderPayload = await req.json();

  const { customerId, total, baskets, products, payments, pickupAddress, deliveryAddress, shippingFee, source } = body;

  try {
    // 1️⃣ Insert order
    // If no baskets exist (pure product purchase), mark as completed
    // If pickupAddress exists, start with 'pick-up' status
    // Otherwise, mark as 'processing' (in-store laundry)
    let orderStatus = "processing";
    if (baskets.length === 0) {
      orderStatus = "completed";
    } else if (pickupAddress) {
      orderStatus = "pick-up";
    }
    const completedAt = baskets.length === 0 ? new Date().toISOString() : null;
    
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        total_amount: total,
        status: orderStatus,
        completed_at: completedAt,
        source: source || "mobile", // Default to mobile if not specified
        pickup_address: pickupAddress || null,
        delivery_address: deliveryAddress || null,
        shipping_fee: shippingFee || 0,
      })
      .select()
      .single();

    if (orderErr || !order) throw orderErr || new Error("Order insertion failed");
    const orderId = order.id;

    // 2️⃣ Insert baskets and basket services
    for (let i = 0; i < baskets.length; i++) {
      const b = baskets[i];
      const { data: basket, error: basketErr } = await supabase
        .from("baskets")
        .insert({
          order_id: orderId,
          basket_number: i + 1,
          weight: b.weight || null,
          price: b.subtotal,
          notes: b.notes || null,
          status: "processing",
        })
        .select()
        .single();

      if (basketErr || !basket) throw basketErr || new Error("Basket insertion failed");
      const basketId = basket.id;

      // Only insert services if present
      if (b.services?.length) {
        // If pickup exists, keep all services as 'pending' (pickup must complete first)
        // Otherwise, set first service as 'in_progress' (in-store laundry)
        const serviceInserts = b.services.map((s, index) => ({
          basket_id: basketId,
          service_id: s.service_id,
          rate: s.rate,
          subtotal: s.subtotal,
          status: (index === 0 && !pickupAddress) ? "in_progress" : "pending",
        }));

        const { error: svcErr } = await supabase.from("basket_services").insert(serviceInserts);
        if (svcErr) throw svcErr;
      }
    }

    // 3️⃣ Insert order products and deduct inventory
    if (products.length) {
      const productInserts = products.map((p) => ({
        order_id: orderId,
        product_id: p.product_id,
        quantity: p.quantity,
        unit_price: p.unit_price,
        subtotal: p.subtotal,
      }));

      const { error: prodErr } = await supabase.from("order_products").insert(productInserts);
      if (prodErr) throw prodErr;

      // Deduct quantities from inventory
      for (const p of products) {
        // Get current product quantity
        const { data: product, error: fetchErr } = await supabase
          .from("products")
          .select("quantity, item_name")
          .eq("id", p.product_id)
          .single();

        if (fetchErr) {
          console.error(`Failed to fetch product ${p.product_id}:`, fetchErr);
          throw new Error(`Failed to fetch product inventory`);
        }

        if (!product) {
          throw new Error(`Product ${p.product_id} not found`);
        }

        const currentQty = Number(product.quantity);
        const orderQty = Number(p.quantity);
        
        // Check if sufficient quantity available
        if (currentQty < orderQty) {
          throw new Error(`Insufficient stock for ${product.item_name}. Available: ${currentQty}, Requested: ${orderQty}`);
        }

        const newQty = currentQty - orderQty;

        // Update product quantity
        const { error: updateErr } = await supabase
          .from("products")
          .update({ 
            quantity: newQty,
            last_updated: new Date().toISOString()
          })
          .eq("id", p.product_id);

        if (updateErr) {
          console.error(`Failed to update product ${p.product_id}:`, updateErr);
          throw new Error(`Failed to update product inventory for ${product.item_name}`);
        }
      }
    }

    // 4️⃣ Insert payments
    if (payments?.length) {
      const paymentInserts = payments.map((pay) => ({
        order_id: orderId,
        amount: pay.amount,
        method: pay.method,
        reference_number: pay.reference || null,
        status: "completed",
      }));

      const { error: payErr } = await supabase.from("payments").insert(paymentInserts);
      if (payErr) throw payErr;
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error("saveOrder API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}
