import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    
    // Stricter validation - ensure id is provided and is not null/undefined
    if (!id || id === null || id === undefined) {
      return NextResponse.json({ error: "Missing or invalid customer ID" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);
      
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove customer:", error);
    return NextResponse.json({ error: "Failed to remove customer" }, { status: 500 });
  }
}
