import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

const serviceTypeOrder = ["wash", "dry", "spin", "iron", "fold"];

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
    // Get the basket with all its services
    const { data: basket, error: basketFetchError } = await supabase
      .from("baskets")
      .select(`
        id,
        order_id,
        basket_services (
          id,
          service_id,
          status,
          services (
            service_type
          )
        )
      `)
      .eq("id", basketId)
      .single();

    if (basketFetchError || !basket) throw basketFetchError || new Error("Basket not found");

    const { order_id, basket_services } = basket;

    // Find the service that is currently in_progress
    const inProgressService = basket_services?.find(
      (bs: any) => bs.status === "in_progress"
    );

    if (!inProgressService) {
      throw new Error("No in_progress service found");
    }

    // Mark the current service as completed
    const { error: completeError } = await supabase
      .from("basket_services")
      .update({ status: "completed" })
      .eq("id", inProgressService.id);

    if (completeError) throw completeError;

    // Find the next service to progress to
    const currentServiceType = (inProgressService.services as any)?.service_type;
    const currentIndex = serviceTypeOrder.indexOf(currentServiceType);

    let nextServiceFound = false;

    // Look for the next service in the order
    for (let i = currentIndex + 1; i < serviceTypeOrder.length; i++) {
      const nextType = serviceTypeOrder[i];
      const nextService = basket_services?.find(
        (bs: any) => bs.services?.service_type === nextType
      );

      if (nextService) {
        // Mark it as in_progress
        const { error: progressError } = await supabase
          .from("basket_services")
          .update({ status: "in_progress" })
          .eq("id", nextService.id);

        if (progressError) throw progressError;
        nextServiceFound = true;
        break;
      }
    }

    // If no next service, complete the basket
    if (!nextServiceFound) {
      const { error: basketCompleteError } = await supabase
        .from("baskets")
        .update({ status: "completed" })
        .eq("id", basketId);

      if (basketCompleteError) throw basketCompleteError;

      // Check if all baskets for this order are completed
      const { data: allBaskets, error: allBasketsError } = await supabase
        .from("baskets")
        .select("status")
        .eq("order_id", order_id);

      if (allBasketsError) throw allBasketsError;

      const allCompleted = allBaskets?.every((b) => b.status === "completed");

      // If all baskets are completed, update order status to completed
      if (allCompleted) {
        const completedAt = new Date().toISOString();
        
        const { data: updateResult, error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "completed", completed_at: completedAt })
          .eq("id", order_id)
          .select();

        if (orderUpdateError) {
          console.error("Order update error:", orderUpdateError);
          throw orderUpdateError;
        }
      } else {
        console.log(`Order ${order_id} still has incomplete baskets. Baskets:`, allBaskets);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error progressing service:", error);
    return NextResponse.json(
      { error: error.message || "Failed to progress service" },
      { status: 500 }
    );
  }
}
