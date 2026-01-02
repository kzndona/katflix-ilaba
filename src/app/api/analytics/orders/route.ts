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

    // Fetch all orders in the date range (inclusive of entire end date)
    const endDatePlusOne = new Date(new Date(endDate).getTime() + 86400000)
      .toISOString()
      .split("T")[0]; // Add 1 day to make the range inclusive

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDatePlusOne); // Use lt instead of lte with next day

    if (ordersError) throw ordersError;

    const totalOrders = orders?.length || 0;

    // Calculate fulfillment breakdown
    let pickupOnly = 0;
    let deliveryOnly = 0;
    let both = 0;
    let inStore = 0;
    let totalAmount = 0;

    orders?.forEach((order: any) => {
      totalAmount += parseFloat(order.total_amount || 0);

      const handling = order.handling || {};
      const hasPickup = handling.pickup && Object.keys(handling.pickup).length > 0 && handling.pickup.address;
      const hasDelivery =
        handling.delivery && Object.keys(handling.delivery).length > 0 && handling.delivery.address;

      if (hasPickup && hasDelivery) {
        both++;
      } else if (hasPickup) {
        pickupOnly++;
      } else if (hasDelivery) {
        deliveryOnly++;
      } else {
        inStore++;
      }
    });

    const avgOrderValue =
      totalOrders > 0 ? parseFloat((totalAmount / totalOrders).toFixed(2)) : 0;

    return NextResponse.json({
      totalOrders,
      avgOrderValue,
      fulfillmentBreakdown: {
        pickupOnly,
        deliveryOnly,
        both,
        inStore,
      },
    });
  } catch (error) {
    console.error("Error fetching orders analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders analytics" },
      { status: 500 }
    );
  }
}
