import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/orders/{orderId}/reject
 * 
 * Rejects a pending mobile app order (cashier unable to fulfill).
 * When rejecting, all baskets in the order are marked as rejected.
 * Inventory is NOT deducted (never was deducted, so no restore needed).
 * 
 * Request body:
 * {
 *   cashier_id: string;        // Staff ID of rejector
 *   reason: string;            // Why the order is being rejected
 *   notes?: string;            // Optional detailed notes
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   orderId: string;
 *   order: OrderRow;           // Updated order with cancelled status
 * }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const { cashier_id, reason, notes } = await req.json();

    // Validate required fields
    if (!cashier_id || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: "cashier_id and reason are required",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Step 1: Fetch the order
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Step 2: Validate order state
    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reject order with status "${order.status}". Only pending orders can be rejected.`,
        },
        { status: 400 }
      );
    }

    if (order.source !== "app") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reject order from source "${order.source}". Only app orders can be rejected.`,
        },
        { status: 400 }
      );
    }

    // Step 3: Verify cashier exists
    const { data: cashier, error: cashierError } = await supabase
      .from("staff")
      .select("id, name")
      .eq("id", cashier_id)
      .single();

    if (cashierError || !cashier) {
      return NextResponse.json(
        { success: false, error: "Cashier not found" },
        { status: 404 }
      );
    }

    // Step 4: Prepare updated breakdown
    const breakdown = { ...order.breakdown };

    // Mark all baskets as rejected
    if (breakdown.baskets && Array.isArray(breakdown.baskets)) {
      breakdown.baskets = breakdown.baskets.map((basket: any) => ({
        ...basket,
        approval_status: "rejected",
        rejection_reason: reason,
      }));
    }

    // Update payment info
    if (breakdown.payment) {
      breakdown.payment.payment_status = "failed";
    }

    // Add audit log entry
    const auditLog = breakdown.audit_log || [];
    auditLog.push({
      timestamp: new Date().toISOString(),
      changed_by: cashier_id,
      action: "order_rejected",
      cancellation_reason: reason,
      details: {
        rejection_reason: reason,
        cashier_notes: notes || null,
        baskets_rejected: breakdown.baskets?.length || 0,
      },
    });
    breakdown.audit_log = auditLog;

    // Step 5: Update order to cancelled status
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        breakdown,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error("Order update error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update order" },
        { status: 500 }
      );
    }

    // Step 6: Send push notification to customer
    try {
      // TODO: Implement push notification service
      // Send notification to customer: "Order Could Not Be Approved"
      console.log(
        `📢 TODO: Send push notification to customer ${order.customer_id}: Order rejected - ${reason}`
      );
    } catch (notifErr) {
      console.warn("Push notification failed:", notifErr);
      // Don't fail the rejection if notification fails
    }

    return NextResponse.json({
      success: true,
      orderId,
      order: updatedOrder,
    });
  } catch (err) {
    console.error("POST /api/orders/{orderId}/reject error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
