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
      result = await supabase.from("staff").insert(data);
    } else {
      // update existing staff
      result = await supabase.from("staff").update(data).eq("id", data.id);
    }

    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to save staff:", error);
    return NextResponse.json({ error: "Failed to save staff" }, { status: 500 });
  }
}
