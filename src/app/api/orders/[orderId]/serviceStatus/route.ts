import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";
import { sendPushNotification } from "@/src/app/utils/send-notification";
import { awardLoyaltyPoints } from "@/src/app/utils/send-notification";

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
      .select("handling, status, cashier_id, customer_id")
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

      // === AWARD LOYALTY POINTS ON COMPLETION ===
      if (order.customer_id) {
        const success = await awardLoyaltyPoints(
          order.customer_id,
          supabase,
          1
        );
        if (!success) {
          console.warn(
            `[Loyalty Points] Failed to award points for order ${orderId}`
          );
        }
      }
    } else if (handlingType === "pickup" && status === "in_progress") {
      // If pickup starts, move to processing and assign cashier
      const updateData: any = { status: "processing" };

      // If staffId is provided and order doesn't have a cashier yet, assign it
      if (staffId && !order.cashier_id) {
        updateData.cashier_id = staffId;
        console.log(
          `[Order Approval] Assigning staff ${staffId} as cashier for order ${orderId}`
        );
      }

      const { error: statusError } = await supabase
        .from("orders")
        .update(updateData)
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

    // === SEND PUSH NOTIFICATION ===
    if (order.customer_id) {
      const handlingTypeLabel = handlingType.charAt(0).toUpperCase() + handlingType.slice(1);
      
      const notificationTitle = action === "start"
        ? handlingType === "pickup" 
          ? "📍 Pickup in Progress"
          : "🚚 Delivery Started"
        : handlingType === "pickup"
          ? "✔️ Pickup Complete"
          : "✅ Successfully Delivered";
      
      const notificationBody = action === "start"
        ? handlingType === "pickup"
          ? "We've started picking your order. Hang tight—almost ready!"
          : "Your order is on its way! Our driver is heading to you."
        : handlingType === "pickup"
          ? "Your order is now ready to collect."
          : "Your order has been delivered successfully. Thank you!";
      
      await sendPushNotification(
        order.customer_id,
        notificationTitle,
        notificationBody,
        undefined,
        {
          orderId,
          notificationType: handlingType === "pickup" ? "pickup" : "delivery",
          metadata: {
            handlingType,
            action,
            status,
          },
        }
      );
    } else {
      console.warn(`[Notification] No customer_id found for order ${orderId}`);
    }

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
