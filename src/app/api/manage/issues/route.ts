import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * GET /api/manage/issues
 * 
 * Fetch all issues from the issues table with customer info
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
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // === FETCH ISSUES ===
    const { data: issues, error: fetchError } = await supabase
      .from("issues")
      .select(
        "id, order_id, basket_number, description, status, severity, reported_by, resolved_by, resolved_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[ISSUES FETCH] Error fetching issues:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch issues" },
        { status: 500 }
      );
    }

    // === FETCH CUSTOMER INFO FOR EACH ISSUE ===
    const enrichedIssues = await Promise.all(
      (issues || []).map(async (issue) => {
        let customer_name = null;
        let customer_phone = null;
        let resolved_by_name = null;

        if (issue.order_id) {
          // Fetch order to get customer_id
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("customer_id")
            .eq("id", issue.order_id)
            .single();

          if (!orderError && order?.customer_id) {
            // Fetch customer info
            const { data: customer, error: customerError } = await supabase
              .from("customers")
              .select("first_name, last_name, phone_number")
              .eq("id", order.customer_id)
              .single();

            if (!customerError && customer) {
              customer_name = `${customer.first_name} ${customer.last_name}`;
              customer_phone = customer.phone_number;
            }
          }
        }

        // Fetch staff name for resolved_by
        if (issue.resolved_by) {
          const { data: staff, error: staffError } = await supabase
            .from("staff")
            .select("first_name, last_name")
            .eq("id", issue.resolved_by)
            .single();

          if (!staffError && staff) {
            resolved_by_name = `${staff.first_name} ${staff.last_name}`;
          }
        }

        return {
          ...issue,
          customer_name,
          customer_phone,
          resolved_by_name,
        };
      })
    );

    return NextResponse.json({
      success: true,
      issues: enrichedIssues || [],
    });
  } catch (error) {
    console.error("[ISSUES FETCH] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
