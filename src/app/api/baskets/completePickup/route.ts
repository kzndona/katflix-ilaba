import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { basketId } = await req.json();

  if (!basketId) {
    return NextResponse.json(
      { error: "Missing basketId" },
      { status: 400 }
    );
  }

  try {
    // Get the basket and order info
    const { data: basket, error: basketFetchError } = await supabase
      .from("baskets")
      .select(`
        id,
        order_id,
        orders (
          id,
          status,
          pickup_address,
          delivery_address
        )
      `)
      .eq("id", basketId)
      .single();

    if (basketFetchError || !basket) throw basketFetchError || new Error("Basket not found");

    const { order_id, orders } = basket;
    const order = orders as any;

    // Check if this is an in-store pickup (pickup_address is null)
    if (!order.pickup_address) {
      // This is in-store, so auto-complete the pickup phase
      // Update order status to next phase or check if delivery is needed
      let nextStatus = "completed"; // Default if no delivery
      
      if (order.delivery_address) {
        // There's a delivery address, so move to "delivering" status
        nextStatus = "delivering";
      }

      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order_id);

      if (orderUpdateError) throw orderUpdateError;
    }

    return NextResponse.json({ success: true, message: "Pickup completed" });
  } catch (error: any) {
    console.error("Error completing pickup:", error);
    return NextResponse.json(
      { error: error.message || "Failed to complete pickup" },
      { status: 500 }
    );
  }
}
