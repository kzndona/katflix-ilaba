import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();

  try {
    // Fetch baskets that are processing, with their services and order/customer info
    const { data: baskets, error: basketError } = await supabase
      .from("baskets")
      .select(`
        id,
        order_id,
        basket_number,
        weight,
        notes,
        price,
        status,
        created_at,
        basket_services (
          id,
          service_id,
          rate,
          subtotal,
          status,
          services (
            id,
            service_type,
            name
          )
        ),
        orders (
          id,
          customer_id,
          status,
          pickup_address,
          delivery_address,
          customers (
            id,
            first_name,
            last_name,
            phone_number,
            email_address
          )
        )
      `)
      .in("status", ["processing"])
      .order("created_at", { ascending: false });

    if (basketError) throw basketError;

    // Transform data to match frontend expectations
    const formattedBaskets = baskets?.map((basket: any) => {
      const pickupAddress = basket.orders?.pickup_address || null;
      const deliveryAddress = basket.orders?.delivery_address || null;

      // Build handling object based on pickup/delivery addresses
      let handling = null;
      if (pickupAddress && deliveryAddress) {
        // Both pickup and delivery
        handling = {
          id: `${basket.id}-handling`,
          type: "pickup-delivery",
          address: `Pickup: ${pickupAddress} • Delivery: ${deliveryAddress}`,
        };
      } else if (pickupAddress) {
        // Pickup only
        handling = {
          id: `${basket.id}-pickup`,
          type: "pickup",
          address: pickupAddress,
        };
      } else if (deliveryAddress) {
        // Delivery only
        handling = {
          id: `${basket.id}-delivery`,
          type: "delivery",
          address: deliveryAddress,
        };
      }

      return {
        id: basket.id,
        order_id: basket.order_id,
        basket_number: basket.basket_number,
        weight: basket.weight,
        notes: basket.notes,
        price: basket.price,
        status: basket.status,
        created_at: basket.created_at,
        customer_name: basket.orders?.customers
          ? `${basket.orders.customers.first_name} ${basket.orders.customers.last_name}`
          : null,
        phone_number: basket.orders?.customers?.phone_number || null,
        email_address: basket.orders?.customers?.email_address || null,
        pickupAddress: pickupAddress,
        deliveryAddress: deliveryAddress,
        orderStatus: basket.orders?.status || null,
        handling,
        washPremium: false,
        dryPremium: false,
        services: buildServiceChain(basket.basket_services, pickupAddress, deliveryAddress, basket.orders?.status || null),
      };
    }) || [];

    return NextResponse.json(formattedBaskets);
  } catch (error: any) {
    console.error("Error fetching processing baskets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch baskets" },
      { status: 500 }
    );
  }
}

// Helper function to build service chain including pickup and delivery as virtual services
function buildServiceChain(basketServices: any[], pickupAddress: string | null, deliveryAddress: string | null, orderStatus: string | null) {
  const services: any[] = [];

  // Add pickup as first service if address exists
  if (pickupAddress) {
    services.push({
      id: `pickup-virtual-${Math.random()}`,
      service_id: "pickup",
      basket_id: "",
      rate: 0,
      subtotal: 0,
      status: orderStatus === "pick-up" ? "in_progress" : "pending",
      service_type: "pickup",
      service_name: "Pickup at Store",
      isVirtual: true,
    });
  }

  // Add actual basket services
  const actualServices = basketServices?.map((bs: any) => ({
    id: bs.id,
    service_id: bs.service_id,
    basket_id: "",
    rate: bs.rate,
    subtotal: bs.subtotal,
    status: bs.status,
    service_type: bs.services?.service_type,
    service_name: bs.services?.name,
    isVirtual: false,
  })) || [];
  
  services.push(...actualServices);

  // Add delivery as last service if address exists
  if (deliveryAddress) {
    services.push({
      id: `delivery-virtual-${Math.random()}`,
      service_id: "delivery",
      basket_id: "",
      rate: 0,
      subtotal: 0,
      status: orderStatus === "delivering" ? "in_progress" : "pending",
      service_type: "delivery",
      service_name: "Delivery to Customer",
      isVirtual: true,
    });
  }

  return services;
}
