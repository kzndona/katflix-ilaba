import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { restoreInventory } from "../inventoryHelpers";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the order with breakdown to access product items
    const { data: order, error: orderFetchErr } = await supabase
      .from("orders")
      .select("id, breakdown")
      .eq("id", id)
      .single();

    if (orderFetchErr || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Restore inventory from breakdown items
    if (order.breakdown?.items && order.breakdown.items.length > 0) {
      const restorationResult = await restoreInventory(
        supabase,
        id,
        order.breakdown.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        }))
      );

      if (!restorationResult.success) {
        console.warn('Some inventory restorations failed:', restorationResult.failedProducts);
        // Log but continue with deletion
      }
    }

    // Delete the order (cascade will delete order_products, baskets, etc.)
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove a order:", error);
    return NextResponse.json({ error: "Failed to remove a order" }, { status: 500 });
  }
}
