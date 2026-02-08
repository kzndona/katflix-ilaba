import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { customerId, deviceToken } = await req.json();

    if (!customerId || !deviceToken) {
      return NextResponse.json(
        { error: "Missing customerId or deviceToken" },
        { status: 400 }
      );
    }

    // Use server-side Supabase with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Store device token in customers table
    const { error } = await supabase
      .from("customers")
      .update({ fcm_device_token: deviceToken })
      .eq("id", customerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}