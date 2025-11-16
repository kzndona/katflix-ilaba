import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {

  console.log("GET inventory called");

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // use service key for admin-level queries
    );

    const { data, error } = await supabase
      .from("products")
      .select("*");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching staff table:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff table" },
      { status: 500 }
    );
  }
}