import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * GET /api/notifications
 * 
 * Fetch notifications for the authenticated customer
 * Supports pagination, filtering by type, and date range filtering
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - type: string (optional) - 'pickup', 'delivery', 'service_update', 'order_status', 'general'
 * - status: string (optional) - 'sent', 'delivered', 'read', 'failed'
 * - startDate: ISO string (optional) - Filter notifications from this date
 * - endDate: ISO string (optional) - Filter notifications until this date
 * - orderId: string (optional) - Filter by specific order
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // === PARSE QUERY PARAMETERS ===
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const orderId = searchParams.get("orderId");

    const offset = (page - 1) * limit;

    // === BUILD QUERY ===
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (type) {
      query = query.eq("type", type);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (orderId) {
      query = query.eq("order_id", orderId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // === EXECUTE QUERY ===
    const { data: notifications, error, count } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    // === RETURN RESPONSE ===
    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error("[NOTIFICATIONS GET] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/mark-all-as-read
 * 
 * Mark all notifications as read for the authenticated customer
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action; // 'mark-as-read' or 'mark-as-unread'

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    if (action === "mark-all-as-read") {
      const { error } = await supabase
        .from("notifications")
        .update({
          status: "read",
          read_at: new Date().toISOString(),
        })
        .eq("customer_id", user.id)
        .eq("status", "delivered");

      if (error) {
        console.error("Error marking notifications as read:", error);
        return NextResponse.json(
          { error: "Failed to mark notifications as read" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[NOTIFICATIONS POST] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
