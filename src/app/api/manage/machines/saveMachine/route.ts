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
      // insert new machine
      result = await supabase.from("machines").insert(data);
    } else {
      // update existing machine
      result = await supabase.from("machines").update(data).eq("id", data.id);
    }

    if (result.error) throw result.error;

  // After saving the machine, check the availability of machines of the same type
    const machineType = data.type;

    const { data: machines, error } = await supabase
    .from("machines")
    .select("status")
    .eq("type", machineType);


    const allUnavailable =
      machines!.length > 0 &&
      machines!.every(m => m.status !== "available");

    if (allUnavailable) {
      await supabase
        .from("services")
        .update({ is_active: false })
        .eq("service_type", machineType);
    } else {
      await supabase
        .from("services")
        .update({ is_active: true })
        .eq("service_type", machineType);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Failed to save machine:", error);
    return NextResponse.json({ error: "Failed to save machine" }, { status: 500 });
  }
}
