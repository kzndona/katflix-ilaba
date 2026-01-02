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

    // Initialize result objects
    const dailyRevenue: Record<string, number> = {};
    const productRevenue: Record<string, number> = {};
    const serviceRevenue: Record<string, number> = {};

    // Process each order
    orders?.forEach((order: any) => {
      const breakdown = order.breakdown;
      // Extract date in UTC to avoid timezone shifting
      const orderDate = order.created_at.substring(0, 10); // Extract YYYY-MM-DD directly from ISO string

      // Daily revenue
      if (!dailyRevenue[orderDate]) {
        dailyRevenue[orderDate] = 0;
      }
      dailyRevenue[orderDate] += parseFloat(order.total_amount || 0);

      // Product revenue from items
      if (breakdown && breakdown.items && Array.isArray(breakdown.items)) {
        breakdown.items.forEach((item: any) => {
          const productName = item.product_name || "Unknown";
          const subtotal = parseFloat(item.subtotal || 0);

          if (!productRevenue[productName]) {
            productRevenue[productName] = 0;
          }
          productRevenue[productName] += subtotal;
        });
      }

      // Service revenue from baskets
      if (breakdown && breakdown.baskets && Array.isArray(breakdown.baskets)) {
        breakdown.baskets.forEach((basket: any) => {
          if (basket.services && Array.isArray(basket.services)) {
            basket.services.forEach((service: any) => {
              const serviceName = service.service_name || "Unknown";
              const subtotal = parseFloat(service.subtotal || 0);

              if (!serviceRevenue[serviceName]) {
                serviceRevenue[serviceName] = 0;
              }
              serviceRevenue[serviceName] += subtotal;
            });
          }
        });
      }
    });

    // Sort and limit data
    const sortedDailyRevenue = Object.entries(dailyRevenue)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, revenue]) => ({
        date,
        revenue: parseFloat(revenue.toFixed(2)),
      }));

    const sortedProductRevenue = Object.entries(productRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([product, revenue]) => ({
        product,
        revenue: parseFloat(revenue.toFixed(2)),
      }));

    const sortedServiceRevenue = Object.entries(serviceRevenue)
      .sort(([, a], [, b]) => b - a)
      .map(([service, revenue]) => ({
        service,
        revenue: parseFloat(revenue.toFixed(2)),
      }));

    return NextResponse.json({
      dailyRevenue: sortedDailyRevenue,
      productRevenue: sortedProductRevenue,
      serviceRevenue: sortedServiceRevenue,
    });
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue analytics" },
      { status: 500 }
    );
  }
}
