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
      .select("id, status")
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
