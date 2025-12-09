import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

const serviceTypeOrder = ["pickup", "wash", "dry", "spin", "iron", "fold", "delivery"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { basketId, serviceType } = await req.json();

  if (!basketId) {
    return NextResponse.json(
      { error: "Missing basketId" },
      { status: 400 }
    );
  }

  try {
    // Get the basket with all its services and order info
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
        ),
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

    const { order_id, basket_services, orders } = basket;
    const order = orders as any;

    // Determine which service to complete
    // If serviceType is provided, use it; otherwise, find the current in_progress service
    let currentServiceType = serviceType;

    if (!currentServiceType) {
      // Check if we're in a virtual service phase (pickup or delivery)
      if (order.status === "pick-up") {
        currentServiceType = "pickup";
      } else if (order.status === "delivering") {
        currentServiceType = "delivery";
      } else {
        // Find the service that is currently in_progress in database
        const inProgressService = basket_services?.find(
          (bs: any) => bs.status === "in_progress"
        );

        if (!inProgressService) {
          throw new Error("No in_progress service found");
        }

        currentServiceType = (inProgressService.services as any)?.service_type;
      }
    }

    const currentIndex = serviceTypeOrder.indexOf(currentServiceType);

    // Handle pickup (virtual service)
    if (currentServiceType === "pickup") {
      // Pickup is handled, continue to next service in the chain
      // No need to do anything special here, just continue to find next service
    } else if (currentServiceType !== "delivery") {
      // This is an actual database service, mark it as completed
      const inProgressService = basket_services?.find(
        (bs: any) => bs.status === "in_progress"
      );

      if (inProgressService) {
        const { error: completeError } = await supabase
          .from("basket_services")
          .update({ status: "completed" })
          .eq("id", inProgressService.id);

        if (completeError) throw completeError;
      }
    }

    // Handle delivery (virtual service)
    if (currentServiceType === "delivery") {
      // Mark basket as completed
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

      // Only mark order as completed if ALL baskets are done
      if (allCompleted) {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", order_id);

        if (orderUpdateError) throw orderUpdateError;
      }

      return NextResponse.json({ success: true, message: "Delivery completed" });
    }

    // Find the next service to progress to
    let nextServiceFound = false;

    // Look for the next service in the order
    for (let i = currentIndex + 1; i < serviceTypeOrder.length; i++) {
      const nextType = serviceTypeOrder[i];

      // Check if this is pickup or delivery
      if (nextType === "pickup") {
        if (order.pickup_address) {
          // Pickup exists, move to it (it's virtual, so just update order status if needed)
          // Update order to "pick-up" status
          const { error: orderUpdateError } = await supabase
            .from("orders")
            .update({ status: "pick-up" })
            .eq("id", order_id);
          if (orderUpdateError) throw orderUpdateError;
          nextServiceFound = true;
          break;
        }
        continue; // Skip pickup if no address
      } else if (nextType === "delivery") {
        if (order.delivery_address) {
          // Delivery exists, move to it (it's virtual)
          // Check if all baskets for this order have completed all their actual services
          const { data: allBaskets, error: allBasketsError } = await supabase
            .from("baskets")
            .select(`
              id,
              basket_services (
                status,
                services (
                  service_type
                )
              )
            `)
            .eq("order_id", order_id);

          if (allBasketsError) throw allBasketsError;

          // Check if all baskets have no pending actual services (all are completed except delivery)
          const allReadyForDelivery = allBaskets?.every((b) => {
            const actualServices = (b.basket_services as any[])?.filter(
              (bs: any) => {
                const serviceType = (bs.services as any)?.service_type?.toLowerCase();
                return serviceType && !["pickup", "delivery"].includes(serviceType);
              }
            ) || [];
            // All actual services must be completed
            return actualServices.every((as: any) => as.status === "completed");
          });

          if (allReadyForDelivery) {
            // Only update order to "delivering" if all baskets are ready
            const { error: orderUpdateError } = await supabase
              .from("orders")
              .update({ status: "delivering" })
              .eq("id", order_id);
            if (orderUpdateError) throw orderUpdateError;
          }
          // Even if not all baskets ready, this basket can still progress
          nextServiceFound = true;
          break;
        }
        continue; // Skip delivery if no address
      } else {
        // This is an actual service, find it in basket_services
        const nextService = basket_services?.find(
          (bs: any) => bs.services?.service_type === nextType && bs.status === "pending"
        );

        if (nextService) {
          // Mark it as in_progress
          const { error: progressError } = await supabase
            .from("basket_services")
            .update({ status: "in_progress" })
            .eq("id", nextService.id);

          if (progressError) throw progressError;

          // If we're transitioning from pickup to actual service, update order status to processing
          if (currentServiceType === "pickup") {
            const { error: orderUpdateError } = await supabase
              .from("orders")
              .update({ status: "processing" })
              .eq("id", order_id);
            if (orderUpdateError) throw orderUpdateError;
          }

          nextServiceFound = true;
          break;
        }
      }
    }

    // If no next service found, mark basket and potentially order as completed
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
        
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "completed", completed_at: completedAt })
          .eq("id", order_id);

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
