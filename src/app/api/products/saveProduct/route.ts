import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;
    if (!data.id) {
      // insert new staff
      result = await supabase.from("inventory").insert(data);
    } else {
      // update existing staff
      result = await supabase.from("inventory").update(data).eq("id", data.id);
    }

    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to save inventory:", error);
    return NextResponse.json({ error: "Failed to save inventory" }, { status: 500 });
  }
}
