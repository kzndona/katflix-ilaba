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
    const { customer, orderPayload } = await req.json();

    if (!customer?.id) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required" },
        { status: 400 }
      );
    }

    if (!orderPayload) {
      return NextResponse.json(
        { success: false, error: "Order payload is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Step 1: Update customer details
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        phone_number: customer.phone_number,
        email_address: customer.email_address,
      })
      .eq("id", customer.id);

    if (customerUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update customer details",
          details: customerUpdateError.message,
        },
        { status: 500 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: orderData.error || "Failed to create order",
          insufficientItems: orderData.insufficientItems,
          partialSuccess: true, // Customer was updated
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
    console.error("Transactional order creation error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
