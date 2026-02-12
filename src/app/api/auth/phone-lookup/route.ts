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

    // Normalize: strip spaces, dashes, and ensure consistent format
    const normalized = phone.replace(/[\s\-()]/g, "");

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("staff")
      .select("email_address")
      .eq("phone_number", normalized)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      // Intentionally vague error message for security
      return NextResponse.json(
        { error: "No account found with that phone number" },
        { status: 404 }
      );
    }

    return NextResponse.json({ email: data.email_address }, { status: 200 });
  } catch (error) {
    console.error("Phone lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
