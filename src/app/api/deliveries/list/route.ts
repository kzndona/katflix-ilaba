import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // Optional filter

    let query = supabase
      .from("orders")
      .select(
        `
        id,
        customer_id,
        status,
        total_amount,
        created_at,
        handling,
        breakdown,
        customers (
          id,
          name,
          phone
        )
      `
      )
      .eq("handling->handling_type", "delivery")
      .in("status", ["pending", "processing"]);

    // Optional status filter
    if (status && ["pending", "processing"].includes(status)) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch deliveries" },
        { status: 500 }
      );
    }

    // Transform response
    const deliveries = (data || []).map((order: any) => ({
      id: order.id,
      customer_id: order.customer_id,
      customer_name: order.customers?.name || "Unknown",
      customer_phone: order.customers?.phone,
      address: order.handling?.delivery_address || "No address",
      lat: order.handling?.delivery_lat,
      lng: order.handling?.delivery_lng,
      items_count: order.breakdown?.baskets?.length || 0,
      total_amount: parseFloat(order.total_amount),
      status: order.status,
      created_at: order.created_at,
      handling_type: order.handling?.handling_type,
    }));

    return NextResponse.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    console.error("Delivery list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
