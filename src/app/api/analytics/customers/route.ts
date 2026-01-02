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

    // Fetch all customers created in the date range (NEW customers)
    const { data: newCustomers, error: newError } = await supabase
      .from("customers")
      .select("id")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (newError) throw newError;

    // Fetch all customers created BEFORE the date range
    const { data: oldCustomers, error: oldError } = await supabase
      .from("customers")
      .select("id")
      .lt("created_at", startDate);

    if (oldError) throw oldError;

    // Get old customer IDs
    const oldCustomerIds = oldCustomers?.map((c: any) => c.id) || [];

    // Fetch all orders in the date range
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("customer_id")
      .gte("created_at", startDate)
      .lt("created_at", new Date(new Date(endDate).getTime() + 86400000).toISOString().split("T")[0]);

    if (ordersError) throw ordersError;

    // Get unique old customer IDs who placed orders in the date range
    const orderingCustomerIds = new Set(
      orders?.map((o: any) => o.customer_id) || []
    );

    // Returning customers = old customers who ordered in the date range (unique count)
    const returningCustomers = oldCustomerIds.filter((id: string) =>
      orderingCustomerIds.has(id)
    ).length; // Get the count of unique customers

    return NextResponse.json({
      newCustomers: newCustomers?.length || 0,
      returningCustomers,
    });
  } catch (error) {
    console.error("Error fetching customers analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers analytics" },
      { status: 500 }
    );
  }
}
