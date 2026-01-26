import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  console.log("GET products called");

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("item_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching products table:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products table" },
      { status: 500 }
    );
  }
}