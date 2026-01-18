import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing staff ID" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Fetch the staff member to get their auth_id
    const { data: staffData, error: fetchError } = await supabase
      .from("staff")
      .select("auth_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch staff:", fetchError);
      throw new Error("Staff member not found");
    }

    // Step 2: Delete the auth user if auth_id exists
    if (staffData?.auth_id) {
      const { error: authError } = await supabase.auth.admin.deleteUser(
        staffData.auth_id
      );

      if (authError) {
        console.error("Failed to delete auth user:", authError);
        // Continue with staff deletion even if auth deletion fails
        // (orphaned auth user is less critical than orphaned staff record)
      }
    }

    // Step 3: Delete the staff record
    const { error: deleteError } = await supabase
      .from("staff")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove staff:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove staff" },
      { status: 500 }
    );
  }
}
