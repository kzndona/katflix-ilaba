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
          customers (
            id,
            first_name,
            last_name
          )
        )
      `)
      .in("status", ["processing"])
      .order("created_at", { ascending: false });

    if (basketError) throw basketError;

    // Transform data to match frontend expectations
    const formattedBaskets = baskets?.map((basket: any) => ({
      id: basket.id,
      order_id: basket.order_id,
      weight: basket.weight,
      notes: basket.notes,
      price: basket.price,
      status: basket.status,
      created_at: basket.created_at,
      customer_name: basket.orders?.customers
        ? `${basket.orders.customers.first_name} ${basket.orders.customers.last_name}`
        : null,
      services: basket.basket_services?.map((bs: any) => ({
        id: bs.id,
        service_id: bs.service_id,
        basket_id: basket.id,
        rate: bs.rate,
        subtotal: bs.subtotal,
        status: bs.status,
        service_type: bs.services?.service_type,
        service_name: bs.services?.name,
      })) || [],
    })) || [];

    return NextResponse.json(formattedBaskets);
  } catch (error: any) {
    console.error("Error fetching processing baskets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch baskets" },
      { status: 500 }
    );
  }
}
