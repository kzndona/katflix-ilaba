import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // use service key for admin-level queries
    );

    const { data, error } = await supabase
      .from("staff")
      .select("*, staff_roles(role_id)")
      .order("last_name");

    if (error) throw error;

    // Transform data to include role
    const transformedData = data.map((staff: any) => ({
      ...staff,
      role: staff.staff_roles?.[0]?.role_id || null,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("Error fetching staff table:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff table" },
      { status: 500 }
    );
  }
}
