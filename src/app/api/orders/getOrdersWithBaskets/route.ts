import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        source,
        customer_id,
        status,
        payment_status,
        total_amount,
        discount,
        pickup_address,
        delivery_address,
        shipping_fee,
        created_at,
        completed_at,
        baskets (
          id,
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
              name,
              service_type
            )
          )
        ),
        order_products (
          id,
          product_id,
          quantity,
          unit_price,
          subtotal,
          products (
            id,
            item_name
          )
        ),
        customers (
          id,
          first_name,
          last_name,
          email_address,
          phone_number
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching orders with baskets:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
