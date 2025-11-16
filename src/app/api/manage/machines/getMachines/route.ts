import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {

  console.log("GET machines called");

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // use service key for admin-level queries
    );

    const { data, error } = await supabase
      .from("machines")
      .select("*");
      
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching machines table:", error);
    return NextResponse.json(
      { error: "Failed to fetch machines table" },
      { status: 500 }
    );
  }
}