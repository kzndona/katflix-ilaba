import { createClient } from "@/src/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize: strip spaces, dashes
    const normalized = phone.replace(/[\s\-()]/g, "");

    // Validate format: must be 09XXXXXXXXX (11 digits)
    if (!/^09\d{9}$/.test(normalized)) {
      return NextResponse.json(
        { error: "Phone number must be in format 09XXXXXXXXX (11 digits)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .select("email_address, auth_id")
      .eq("phone_number", normalized)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "No account found with that phone number" },
        { status: 404 }
      );
    }

    if (!data.auth_id) {
      return NextResponse.json(
        { error: "This account has not been set up for login yet. Please contact the store." },
        { status: 403 }
      );
    }

    if (!data.email_address) {
      return NextResponse.json(
        { error: "No email associated with this account. Please contact the store." },
        { status: 404 }
      );
    }

    return NextResponse.json({ email: data.email_address }, { status: 200 });
  } catch (error) {
    console.error("Customer phone lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
