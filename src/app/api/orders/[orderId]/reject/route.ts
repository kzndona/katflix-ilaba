import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * POST /api/orders/{orderId}/reject
 * 
 * Reject a mobile order (change status to cancelled)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // === PARSE REQUEST ===
    const body = await request.json();
    const { cashier_id, reason, notes } = body;

    if (!cashier_id) {
      return NextResponse.json(
        { success: false, error: "cashier_id required" },
        { status: 400 }
      );
    }

    // === FETCH CURRENT ORDER ===
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, customer_id")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // === UPDATE ORDER STATUS TO CANCELLED ===
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[ORDER REJECT] Error updating order:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to reject order" },
        { status: 500 }
      );
    }

    // === SUBTRACT LOYALTY POINT FROM CUSTOMER ===
    if (order.customer_id) {
      // Fetch current loyalty points
      const { data: customer, error: fetchCustomerError } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", order.customer_id)
        .single();

      if (!fetchCustomerError && customer) {
        const currentPoints = customer.loyalty_points || 0;
        const newPoints = Math.max(0, currentPoints - 1); // Subtract 1, minimum 0

        const { error: loyaltyError } = await supabase
          .from("customers")
          .update({
            loyalty_points: newPoints
          })
          .eq("id", order.customer_id);

        if (loyaltyError) {
          console.warn("[ORDER REJECT] Warning: Failed to subtract loyalty point:", loyaltyError);
        } else {
          console.log("[ORDER REJECT] Loyalty point subtracted for customer:", {
            customer_id: order.customer_id,
            previous_points: currentPoints,
            new_points: newPoints
          });
        }
      }
    }

    console.log("[ORDER REJECT] Success:", {
      order_id: orderId,
      previous_status: order.status,
      new_status: "cancelled",
      reason,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: "Order rejected successfully",
    });
  } catch (error) {
    console.error("[ORDER REJECT] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
