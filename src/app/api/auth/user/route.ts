import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch the staff record to get the email_address and staff ID
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id, email_address, first_name, last_name")
      .eq("auth_id", user.id)
      .single();

    if (staffError || !staffData) {
      // Fallback to auth user email if staff record not found
      return NextResponse.json(
        {
          email: user.email || "",
          id: user.id,
          staff_id: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        email: staffData.email_address || user.email || "",
        firstName: staffData.first_name,
        lastName: staffData.last_name,
        id: user.id,
        staff_id: staffData.id,
        staff_name: `${staffData.first_name} ${staffData.last_name}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
