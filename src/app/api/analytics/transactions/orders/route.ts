import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing startDate or endDate" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all orders in the date range with customer details
    const endDatePlusOne = new Date(new Date(endDate).getTime() + 86400000)
      .toISOString()
      .split("T")[0];

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        created_at,
        total_amount,
        breakdown,
        customers!orders_customer_id_fkey (
          first_name,
          last_name
        )
      `
      )
      .gte("created_at", startDate)
      .lt("created_at", endDatePlusOne);

    if (ordersError) throw ordersError;

    // Transform orders into transaction format
    const orderTransactions = (orders || []).map((order: any) => ({
      orderId: order.id,
      date: order.created_at,
      customerName: `${order.customers?.first_name || ""} ${
        order.customers?.last_name || ""
      }`.trim(),
      amount: parseFloat(order.total_amount || 0),
      paymentMethod: order.breakdown?.payment?.method || "Unknown",
    }));

    return NextResponse.json(orderTransactions);
  } catch (error) {
    console.error("Error fetching order transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch order transactions" },
      { status: 500 }
    );
  }
}
