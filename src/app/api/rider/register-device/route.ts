import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/rider/register-device
 *
 * Register a rider's FCM device token for push notifications.
 * Called from the rider companion Flutter app after login.
 *
 * Body: { staffId: string, deviceToken: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { staffId, deviceToken } = await req.json();

    if (!staffId || !deviceToken) {
      return NextResponse.json(
        { error: "Missing staffId or deviceToken" },
        { status: 400 }
      );
    }

    // Use server-side Supabase with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Verify the staff member has the "rider" role
    const { data: roleData, error: roleError } = await supabase
      .from("staff_roles")
      .select("role_id")
      .eq("staff_id", staffId)
      .eq("role_id", "rider")
      .single();

    if (roleError || !roleData) {
      return NextResponse.json(
        { error: "Staff member is not a rider" },
        { status: 403 }
      );
    }

    // Store device token in staff table
    const { error } = await supabase
      .from("staff")
      .update({ fcm_device_token: deviceToken })
      .eq("id", staffId);

    if (error) throw error;

    console.log(`✅ Rider device token registered for staff ${staffId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Failed to register rider device:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
