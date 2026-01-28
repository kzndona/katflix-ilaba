import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        customer_id,
        status,
        total_amount,
        created_at,
        updated_at,
        handling,
        breakdown,
        customers (
          id,
          name,
          phone,
          email
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Get services progress for this order
    const { data: servicesProgress, error: servicesError } = await supabase
      .from("basket_service_status")
      .select("*")
      .eq("order_id", orderId)
      .order("basket_number", { ascending: true })
      .order("service_type", { ascending: true });

    if (servicesError) {
      console.error("Services progress error:", servicesError);
    }

    // Transform baskets from breakdown
    const baskets = (order.breakdown?.baskets || []).map(
      (basket: any, index: number) => ({
        number: index + 1,
        items: basket.items || [],
        total: basket.total || 0,
        services_progress: servicesProgress?.filter(
          (sp: any) => sp.basket_number === index + 1
        ) || [],
      })
    );

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        customer_id: order.customer_id,
        customer_name: order.customers?.[0]?.name,
        customer_phone: order.customers?.[0]?.phone,
        customer_email: order.customers?.[0]?.email,
        address: order.handling?.delivery_address,
        lat: order.handling?.delivery_lat,
        lng: order.handling?.delivery_lng,
        handling_type: order.handling?.handling_type,
        payment_method: order.handling?.payment_method,
        special_instructions: order.handling?.special_instructions,
        total_amount: parseFloat(order.total_amount),
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        baskets,
      },
    });
  } catch (error) {
    console.error("Delivery details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
