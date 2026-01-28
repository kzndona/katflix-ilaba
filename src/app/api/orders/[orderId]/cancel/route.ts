/**
 * POST /api/orders/:orderId/cancel
 * 
 * Cancel an order and create timeline entries for all services
 * - Updates order status to 'cancelled'
 * - Creates basket_service_status entries with 'skipped' status
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  console.log("[CANCEL ORDER] POST /api/orders/:orderId/cancel called for order:", orderId);

  const supabase = await createClient();

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

    // Get staff record for who cancelled
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id, first_name, last_name")
      .eq("auth_id", user.id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: "Staff record not found" },
        { status: 401 }
      );
    }

    const cancelledByStaffId = staffData.id;

    // === FETCH ORDER ===
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, breakdown, status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Don't allow cancelling already cancelled orders
    if (order.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Order is already cancelled" },
        { status: 400 }
      );
    }

    // === UPDATE ORDER STATUS ===
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (updateError) {
      console.error("[CANCEL ORDER] Failed to update order:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to cancel order" },
        { status: 500 }
      );
    }

    // === CREATE TIMELINE ENTRIES ===
    const breakdown = order.breakdown || {};
    const baskets = breakdown.baskets || [];

    // Collect all service entries to create
    const timelineEntries: Array<{
      order_id: string;
      basket_number: number;
      service_type: string;
      status: string;
      completed_by: string;
      notes: string;
    }> = [];

    for (const basket of baskets) {
      const services = basket.services || {};
      const basketNumber = basket.basket_number || 0;

      // Check each service type
      const serviceTypes = ["wash", "dry", "spin", "iron", "fold"];
      for (const serviceType of serviceTypes) {
        const serviceValue = services[serviceType];

        // Only create entry if service is active (not "off" or false)
        if (serviceValue && serviceValue !== "off" && serviceValue !== false) {
          timelineEntries.push({
            order_id: orderId,
            basket_number: basketNumber,
            service_type: serviceType,
            status: "skipped",
            completed_by: cancelledByStaffId,
            notes: `Order cancelled by ${staffData.first_name} ${staffData.last_name}`,
          });
        }
      }
    }

    console.log(`[CANCEL ORDER] Creating ${timelineEntries.length} timeline entries`);

    // Insert timeline entries if any
    if (timelineEntries.length > 0) {
      const { error: insertError } = await supabase
        .from("basket_service_status")
        .insert(timelineEntries);

      if (insertError) {
        console.error("[CANCEL ORDER] Failed to create timeline entries:", insertError);
        // Don't fail the entire cancellation if timeline creation fails
        // The order is already cancelled, just log the error
      }
    }

    console.log("[CANCEL ORDER] Order cancelled successfully");

    return NextResponse.json(
      { success: true, message: "Order cancelled successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CANCEL ORDER] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
