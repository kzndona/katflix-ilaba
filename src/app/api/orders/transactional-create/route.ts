/**
 * POST /api/orders/transactional-create
 * 
 * POS ORDER CREATION ENDPOINT
 * 
 * This endpoint:
 * 1. Updates customer phone/email (if provided)
 * 2. Creates order with JSONB breakdown and handling
 * 
 * ============================================================================
 * REQUEST FORMAT (POS ONLY)
 * ============================================================================
 * {
 *   "customer": {
 *     "id": "customer-uuid",
 *     "phone_number": "+639123456789",
 *     "email_address": "customer@example.com"
 *   },
 *   "orderPayload": {
 *     "source": "store",
 *     "customer_id": "customer-uuid",
 *     "cashier_id": "staff-uuid" (or null for mobile),
 *     "status": "processing",
 *     "total_amount": 500,
 *     "breakdown": { ...JSONB breakdown object... },
 *     "handling": { ...JSONB handling object... },
 *     "order_note": "Special instructions",
 *     "gcash_receipt_url": "https://bucket-url/path/to/receipt.jpg" (optional)
 *   }
 * }
 * 
 * ============================================================================
 * RESPONSE (Success)
 * ============================================================================
 * { "success": true, "orderId": "order-uuid", "order": {...} }
 * 
 * ============================================================================
 * ERROR RESPONSES
 * ============================================================================
 * 400: Missing customer_id or orderPayload
 * 404: Customer or staff not found
 * 500: Database or processing error
 */

import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validateStockAvailability, deductInventory } from "@/src/app/api/orders/inventoryHelpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let customer, orderPayload;

    // ========== VALIDATE POS FORMAT ==========
    // Expected: { customer: {...}, orderPayload: {...} }
    
    const isPOSFormat = body.customer && body.orderPayload && (body.orderPayload.breakdown || body.orderPayload.handling);

    if (!isPOSFormat) {
      console.error("❌ Invalid format - expected POS format with customer and orderPayload containing breakdown/handling");
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid payload format. Expected POS format: { customer: {...}, orderPayload: {...breakdown, handling...} }",
          receivedKeys: Object.keys(body),
          payloadKeys: body.orderPayload ? Object.keys(body.orderPayload) : null
        },
        { status: 400 }
      );
    }

    // ========== EXTRACT POS FORMAT ==========
    customer = body.customer;
    orderPayload = body.orderPayload;
    
    // Extract loyalty info (if present)
    const loyaltyPointsUsed = orderPayload.loyaltyPointsUsed || 0;
    const loyaltyDiscountAmount = orderPayload.loyaltyDiscountAmount || 0;
    const loyaltyDiscountPercentage = orderPayload.loyaltyDiscountPercentage || 0;
    
    console.log("📥 POS Format order received");
    // Preserve source from orderPayload (app or store), default to 'store' for backwards compatibility
    if (!orderPayload.source) {
      orderPayload.source = 'store';
    }

    // ========== VALIDATE CUSTOMER ==========
    if (!customer?.id) {
      console.error("❌ Customer ID missing");
      return NextResponse.json(
        { 
          success: false, 
          error: "Customer ID is required",
          debug: {
            customerReceived: !!customer,
            customerKeys: customer ? Object.keys(customer) : null,
          }
        },
        { status: 400 }
      );
    }

    if (!orderPayload) {
      console.error("❌ Order payload missing");
      return NextResponse.json(
        { 
          success: false, 
          error: "Order payload is required"
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ========== VALIDATE & DEDUCT INVENTORY ==========
    // Extract product items from breakdown for inventory management
    const productItems = orderPayload.breakdown?.items || [];
    
    if (productItems.length > 0) {
      console.log("🔍 Validating product inventory...");
      
      // Validate stock availability
      const stockCheck = await validateStockAvailability(supabase, productItems);
      
      if (!stockCheck.available) {
        console.error("❌ Insufficient stock for products:", stockCheck.insufficientItems);
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient stock for one or more products",
            insufficientItems: stockCheck.insufficientItems,
          },
          { status: 400 }
        );
      }
      
      console.log("✓ Stock validated successfully");
    }

    // ========== UPDATE CUSTOMER DETAILS ==========
    const updateData: any = {};
    if (customer.phone_number) updateData.phone_number = customer.phone_number;
    if (customer.email_address) updateData.email_address = customer.email_address;

    if (Object.keys(updateData).length > 0) {
      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", customer.id);

      if (customerUpdateError) {
        console.error("❌ Customer update failed:", customerUpdateError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update customer details",
            errorMessage: customerUpdateError.message,
          },
          { status: 500 }
        );
      }
      console.log("✓ Customer details updated");
    }

    // ========== CREATE ORDER ==========
    // Call /api/orders which handles POS format
    console.log("📦 Calling /api/orders endpoint...");
    
    // Get the origin from request headers - construct properly
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const origin = `${protocol}://${host}`;
    
    console.log(`Using origin for internal fetch: ${origin}`);
    
    const orderRes = await fetch(`${origin}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    console.log("📥 /api/orders response:", { 
      status: orderRes.status, 
      ok: orderRes.ok,
      responseKeys: Object.keys(orderData),
      hasSuccess: orderData?.success,
      hasOrderId: orderData?.orderId,
      orderId: orderData?.orderId
    });

    if (!orderRes.ok) {
      console.error("❌ Order creation failed:", { status: orderRes.status, error: orderData.error });
      return NextResponse.json(
        {
          success: false,
          error: orderData.error || "Failed to create order",
          debugInfo: {
            endpoint: "/api/orders",
            statusCode: orderRes.status,
            responseKeys: orderData ? Object.keys(orderData) : null,
          }
        },
        { status: orderRes.status }
      );
    }

    if (!orderData.success || !orderData.orderId) {
      console.error("❌ Unexpected order response format:", { 
        success: orderData?.success, 
        orderId: orderData?.orderId,
        allKeys: Object.keys(orderData)
      });
      return NextResponse.json(
        {
          success: false,
          error: "Order creation returned unexpected format",
        },
        { status: 500 }
      );
    }

    console.log("✓ Order created successfully:", orderData.orderId);
    
    // ========== DEDUCT INVENTORY ==========
    // Now that order exists, deduct inventory for all products
    if (productItems.length > 0) {
      console.log("📦 Deducting inventory for products...");
      
      const deductionResult = await deductInventory(supabase, orderData.orderId, productItems);
      
      if (!deductionResult.success) {
        console.error("⚠️ Inventory deduction failed for some products:", deductionResult.failedProducts);
        // Log the error but don't fail the order creation - inventory helpers handles partial failures
        // The order exists but inventory deduction had issues
      } else {
        console.log("✓ Inventory deducted successfully:", deductionResult.deductedProducts.map(p => `${p.productName}(${p.quantity})`).join(", "));
      }
    }
    
    // ========== HANDLE LOYALTY DISCOUNT ==========
    // Deduct loyalty points if any were used (no hard cap on max points)
    if (loyaltyPointsUsed > 0) {
      const { data: customerLoyalty } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customer.id)
        .single();

      if (customerLoyalty) {
        const newPoints = Math.max(0, (customerLoyalty.loyalty_points || 0) - loyaltyPointsUsed);
        const { error: loyaltyError } = await supabase
          .from('customers')
          .update({ loyalty_points: newPoints })
          .eq('id', customer.id);

        if (loyaltyError) {
          console.warn('Loyalty points deduction failed (non-critical):', loyaltyError.message);
        } else {
          console.log(`✓ Loyalty points deducted (${loyaltyPointsUsed} points used). New total: ${newPoints}`);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      order: orderData.order,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Transactional order creation error:", errorMsg);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during order creation",
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
