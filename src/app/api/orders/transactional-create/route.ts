/**
 * POST /api/orders/transactional-create
 * 
 * Updates customer details and creates an order in a single logical transaction.
 * If customer update fails, the order creation is not attempted.
 * If order creation fails after customer update, the customer update has already been persisted
 * (this is acceptable as customer details are being edited in POS).
 * 
 * Request body:
 * {
 *   customer: { id, phone_number, email_address },
 *   orderPayload: { source, customer_id, cashier_id, status, total_amount, order_note, breakdown, handling }
 * }
 */

import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { customer, orderPayload } = body;

    console.log("📥 Transactional create request:", { customer, orderPayload: orderPayload ? "present" : "missing", bodyKeys: Object.keys(body) });

    // Support both formats:
    // Format 1: { customer: { id, phone_number, email_address }, orderPayload: {...} }
    // Format 2: { customer_id: "...", phone_number: "...", email_address: "...", ...orderPayload }
    if (!customer && body.customer_id) {
      customer = {
        id: body.customer_id,
        phone_number: body.phone_number,
        email_address: body.email_address,
      };
      orderPayload = body;
    }

    if (!customer?.id) {
      console.error("❌ Customer validation failed:", { customer, keys: customer ? Object.keys(customer) : "null" });
      return NextResponse.json(
        { 
          success: false, 
          error: "Customer ID is required", 
          debug: {
            customerReceived: !!customer,
            customerKeys: customer ? Object.keys(customer) : null,
            customerId: customer?.id,
            supportedFormats: [
              "{ customer: { id, phone_number, email_address }, orderPayload: {...} }",
              "{ customer_id: ..., phone_number: ..., email_address: ..., ...orderPayload }"
            ]
          }
        },
        { status: 400 }
      );
    }

    if (!orderPayload) {
      console.error("❌ Order payload missing:", { body });
      return NextResponse.json(
        { 
          success: false, 
          error: "Order payload is required",
          debug: { receivedBodyKeys: Object.keys(body) }
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Step 1: Update customer details (only if phone_number or email_address provided)
    const updateData: any = {};
    if (customer.phone_number) updateData.phone_number = customer.phone_number;
    if (customer.email_address) updateData.email_address = customer.email_address;

    if (Object.keys(updateData).length > 0) {
      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", customer.id);

      if (customerUpdateError) {
        console.error("❌ Customer update failed:", { code: customerUpdateError.code, message: customerUpdateError.message });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update customer details",
            errorCode: customerUpdateError.code,
            errorMessage: customerUpdateError.message,
            customerId: customer.id,
          },
          { status: 500 }
        );
      }
    }

    // Step 2: Create order via the standard orders endpoint
    // This delegates stock validation and inventory deduction to the existing endpoint
    const orderRes = await fetch(
      new URL("/api/orders", req.url).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      }
    );

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      // Customer was already updated, but order creation failed
      console.error("❌ Order creation failed:", { status: orderRes.status, error: orderData.error });
      return NextResponse.json(
        {
          success: false,
          error: orderData.error || "Failed to create order",
          insufficientItems: orderData.insufficientItems,
          partialSuccess: true, // Customer was updated
          debugInfo: {
            endpointCalled: "/api/orders",
            statusCode: orderRes.status,
            responseKeys: orderData ? Object.keys(orderData) : null,
          }
        },
        { status: orderRes.status }
      );
    }

    if (!orderData.success || !orderData.order?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order creation returned unexpected format",
          partialSuccess: true, // Customer was updated
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: orderData.order.id,
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
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      },
      { status: 500 }
    );
  }
}
