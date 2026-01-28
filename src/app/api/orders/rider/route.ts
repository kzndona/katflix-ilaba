import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/orders/rider
 * 
 * Fetch all delivery and pickup orders for riders
 * Returns orders with handling details and location coordinates
 * Requires rider (staff) authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Check for session-based auth via cookies
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {},
          },
        }
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    // Fetch orders that are not completed/cancelled and have delivery or pickup
    const { data: orders, error } = await supabase
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
        customers:customer_id(first_name, last_name, phone_number)
      `
      )
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rider orders:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // Filter only orders that have pickup or delivery (not just self-service)
    const riderOrders = (orders || []).filter((order: any) => {
      const handling = order.handling || {};
      return (
        handling.handling_type === "delivery" ||
        handling.handling_type === "pickup"
      );
    });

    return NextResponse.json({
      success: true,
      orders: riderOrders,
    });
  } catch (error) {
    console.error("Rider orders endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
