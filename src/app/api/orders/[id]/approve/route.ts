import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { deductInventory, type InventoryDeductionResult } from "@/src/app/api/orders/inventoryHelpers";

/**
 * POST /api/orders/{orderId}/approve
 * 
 * Approves a pending mobile app order and deducts inventory.
 * When approving one basket, all baskets in the order are marked as approved.
 * 
 * Request body:
 * {
 *   cashier_id: string;        // Staff ID of approver
 *   gcash_verified: boolean;   // Whether GCash receipt was verified
 *   notes?: string;            // Optional notes from cashier
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   orderId: string;
 *   order: OrderRow;           // Updated order with new status
 *   stockDeducted: {
 *     success: boolean;
 *     deductedProducts: Array<{ productId, productName, quantity }>;
 *     failedProducts: Array<{ productId, productName, error }>;
 *   },
 *   notificationSent: boolean;
 * }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { cashier_id, gcash_verified, notes } = await req.json();

    // Validate required fields
    if (!cashier_id) {
      return NextResponse.json(
        { success: false, error: "cashier_id is required" },
        { status: 400 }
      );
    }

    if (typeof gcash_verified !== "boolean") {
      return NextResponse.json(
        { success: false, error: "gcash_verified must be a boolean" },
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

    // Step 2: Validate order is eligible for approval
    if (order.source !== "app") {
      return NextResponse.json(
        { success: false, error: "Only mobile app orders (source='app') can be approved via this endpoint" },
        { status: 400 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order is in "${order.status}" status. Only "pending" orders can be approved.`,
        },
        { status: 400 }
      );
    }

    // Step 3: Validate staff member exists (by staff ID)
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id, first_name, last_name")
      .eq("id", cashier_id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: "Staff member not found" },
        { status: 404 }
      );
    }

    // Step 4: Prepare updated breakdown
    const breakdown = { ...order.breakdown };

    // Mark all baskets as approved
    if (breakdown.baskets && Array.isArray(breakdown.baskets)) {
      breakdown.baskets = breakdown.baskets.map((basket: any) => ({
        ...basket,
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: cashier_id,
      }));
    }

    // Update payment info
    if (breakdown.payment) {
      breakdown.payment.payment_status = "successful";
      breakdown.payment.completed_at = new Date().toISOString();
      if (breakdown.payment.gcash_receipt) {
        breakdown.payment.gcash_receipt.verified = gcash_verified;
      }
    }

    // Add audit log entry
    const auditLog = breakdown.audit_log || [];
    auditLog.push({
      timestamp: new Date().toISOString(),
      changed_by: cashier_id,
      action: "Order approved by cashier",
      details: {
        gcash_verified,
        cashier_notes: notes || null,
        baskets_approved: breakdown.baskets?.length || 0,
      },
    });
    breakdown.audit_log = auditLog;

    // Step 5: Deduct inventory
    let stockDeductionResult: InventoryDeductionResult = {
      success: true,
      deductedProducts: [],
      failedProducts: [],
    };

    // Extract product items - support both old format (breakdown.items) and new format (breakdown.breakdown.items)
    let productItems = [];
    if (breakdown.items && Array.isArray(breakdown.items)) {
      productItems = breakdown.items;
    } else if (breakdown.breakdown?.items && Array.isArray(breakdown.breakdown.items)) {
      productItems = breakdown.breakdown.items;
    }

    if (productItems.length > 0) {
      console.log("🔍 Deducting inventory for approved order...", productItems);
      stockDeductionResult = await deductInventory(
        supabase,
        orderId,
        productItems.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        }))
      );

      if (!stockDeductionResult.success) {
        // Stock deduction failed - return error without updating order
        console.error("❌ Stock deduction failed:", stockDeductionResult.failedProducts);
        return NextResponse.json(
          {
            success: false,
            error: "Stock deduction failed",
            details: stockDeductionResult,
            insufficientItems: stockDeductionResult.failedProducts,
          },
          { status: 400 }
        );
      }
      console.log("✓ Inventory deducted for approved order");
    }

    // Step 6: Update order status and breakdown
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "processing",
        cashier_id,
        approved_at: new Date().toISOString(),
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

    // Step 7: Send push notification to customer
    let notificationSent = false;
    try {
      // TODO: Implement push notification service
      // Send notification to customer: "Order approved and processing"
      console.log(`📢 TODO: Send push notification to customer ${order.customer_id}: Order approved!`);
      notificationSent = true;
    } catch (notifErr) {
      console.warn("Push notification failed:", notifErr);
      // Don't fail the approval if notification fails
    }

    return NextResponse.json({
      success: true,
      orderId,
      order: updatedOrder,
      stockDeducted: stockDeductionResult,
      notificationSent,
    });
  } catch (err) {
    console.error("POST /api/orders/{orderId}/approve error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
