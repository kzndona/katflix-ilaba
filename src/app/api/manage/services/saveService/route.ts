import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate required fields
    if (!data.service_type || !data.name) {
      return NextResponse.json(
        { success: false, error: "service_type and name are required" },
        { status: 400 }
      );
    }

    // Ensure modifiers is valid JSONB (or null)
    if (data.modifiers && typeof data.modifiers === "string") {
      try {
        data.modifiers = JSON.parse(data.modifiers);
      } catch {
        return NextResponse.json(
          { success: false, error: "modifiers must be valid JSON" },
          { status: 400 }
        );
      }
    }

    // Ensure sort_order is numeric
    if (data.sort_order) {
      data.sort_order = parseInt(data.sort_order, 10);
    }

    let result;
    if (!data.id) {
      // insert new service
      const { id, ...dataToInsert } = data;
      result = await supabase.from("services").insert(dataToInsert).select();
    } else {
      // update existing service
      result = await supabase
        .from("services")
        .update(data)
        .eq("id", data.id)
        .select();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.data?.[0],
    });
  } catch (error) {
    console.error("Failed to save service:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save service" },
      { status: 500 }
    );
  }
}
