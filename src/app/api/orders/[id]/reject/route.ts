import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { restoreInventory } from "@/src/app/api/orders/inventoryHelpers";

/**
 * POST /api/orders/{orderId}/reject
 * 
 * Rejects a pending mobile app order (cashier unable to fulfill).
 * When rejecting, all baskets in the order are marked as rejected.
 * Inventory IS restored (was deducted at order creation, now returned).
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { cashier_id, reason, notes } = await req.json();

    console.log("🔴 REJECT ENDPOINT - Received request:", {
      orderId,
      cashier_id,
      reason,
      notes,
    });

    // Validate required fields
    if (!cashier_id || !reason) {
      console.error("❌ Missing required fields:", { cashier_id, reason });
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

    console.log("🔴 REJECT ENDPOINT - Step 1 (Fetch order):", {
      orderId,
      fetchError: fetchError?.message,
      orderExists: !!order,
      orderStatus: order?.status,
      orderSource: order?.source,
    });

    if (fetchError || !order) {
      console.error("❌ Order not found:", fetchError?.message);
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

    // Step 3: Verify staff member exists (by staff ID)
    console.log("🔴 REJECT ENDPOINT - Step 3 (Lookup staff):", {
      cashier_id,
    });

    const { data: cashier, error: cashierError } = await supabase
      .from("staff")
      .select("id, first_name, last_name")
      .eq("id", cashier_id)
      .single();

    console.log("🔴 REJECT ENDPOINT - Step 3 result:", {
      cashierError: cashierError?.message,
      cashierFound: !!cashier,
      cashierData: cashier,
    });

    if (cashierError || !cashier) {
      console.error("❌ Staff not found:", {
        cashierError: cashierError?.message,
        code: cashierError?.code,
      });
      return NextResponse.json(
        { success: false, error: "Staff member not found" },
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
    // Assign the rejecting staff member as the cashier if not already assigned
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cashier_id: order.cashier_id || cashier_id, // Assign staff member if no cashier yet
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

    // Step 5b: Restore inventory from breakdown items
    if (order.breakdown?.items && order.breakdown.items.length > 0) {
      console.log("📦 Restoring inventory for rejected order...");
      
      const restorationResult = await restoreInventory(
        supabase,
        orderId,
        order.breakdown.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        }))
      );

      if (!restorationResult.success) {
        console.warn('⚠️ Some inventory restorations failed:', restorationResult.failedProducts);
        // Log but continue - don't fail the rejection
      } else {
        console.log('✓ Inventory restored successfully:', restorationResult.deductedProducts.map(p => `${p.productName}(${p.quantity})`).join(", "));
      }
    }

    // Step 6: Decrement loyalty points for cancelled order
    try {
      const { data: customerLoyalty } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', order.customer_id)
        .single();

      if (customerLoyalty) {
        const newPoints = Math.max(0, (customerLoyalty.loyalty_points || 0) - 1);
        const { error: loyaltyError } = await supabase
          .from('customers')
          .update({ loyalty_points: newPoints })
          .eq('id', order.customer_id);

        if (loyaltyError) {
          console.warn('Loyalty points decrement failed (non-critical):', loyaltyError.message);
        } else {
          console.log('✓ Loyalty point deducted from customer:', order.customer_id, '(new total:', newPoints, ')');
        }
      }
    } catch (loyaltyErr) {
      console.warn('Loyalty update error (non-critical):', loyaltyErr);
    }

    // Step 7: Send push notification to customer
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
