import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * PATCH /api/orders/{orderId}/serviceStatus
 * 
 * Update handling status (pickup/delivery)
 * Legacy endpoint for handling updates (not service updates)
 */

export async function PATCH(
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
    const { staffId, action, handlingType } = body;

    if (!action || !handlingType) {
      return NextResponse.json(
        { success: false, error: "action and handlingType required" },
        { status: 400 }
      );
    }

    if (!["start", "complete"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    if (!["pickup", "delivery"].includes(handlingType)) {
      return NextResponse.json(
        { success: false, error: "Invalid handlingType" },
        { status: 400 }
      );
    }

    // === FETCH CURRENT ORDER ===
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("handling, status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // === UPDATE HANDLING STATUS ===
    const handling = order.handling || {};
    const status = action === "start" ? "in_progress" : "completed";
    const now = new Date().toISOString();

    // Update the appropriate handling section
    const updatedHandling = {
      ...handling,
      [handlingType]: {
        ...(handling[handlingType as keyof typeof handling] || {}),
        status,
        ...(action === "start" && { started_at: now }),
        ...(action === "complete" && { completed_at: now }),
      },
    };

    // Save updated handling
    const { error: updateError } = await supabase
      .from("orders")
      .update({ handling: updatedHandling })
      .eq("id", orderId);

    if (updateError) {
      console.error("[HANDLING UPDATE] Error updating handling:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update handling status" },
        { status: 500 }
      );
    }

    // === UPDATE ORDER STATUS IF NEEDED ===
    if (handlingType === "delivery" && status === "completed") {
      // If delivery is completed, mark order as completed
      const { error: statusError } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      if (statusError) {
        console.warn("[Order Status Update] Warning:", statusError);
      } else {
        console.log(
          `[Order Status Update] Order ${orderId} updated to completed (delivery done)`
        );
      }
    } else if (
      handlingType === "pickup" &&
      status === "in_progress" &&
      order.status === "for_pick-up"
    ) {
      // If pickup starts and order is ready for pickup, update to processing
      const { error: statusError } = await supabase
        .from("orders")
        .update({ status: "processing" })
        .eq("id", orderId);

      if (statusError) {
        console.warn("[Order Status Update] Warning:", statusError);
      } else {
        console.log(
          `[Order Status Update] Order ${orderId} updated to processing (pickup started)`
        );
      }
    }

    console.log("[HANDLING UPDATE] Success:", {
      order_id: orderId,
      handling_type: handlingType,
      action,
      new_status: status,
    });

    return NextResponse.json({
      success: true,
      message: `${handlingType} status updated to ${status}`,
    });
  } catch (error) {
    console.error("[HANDLING UPDATE] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
