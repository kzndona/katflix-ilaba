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

    // Step 1: Fetch the customer to get their auth_id
    const { data: customerData, error: fetchError } = await supabase
      .from("customers")
      .select("auth_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch customer:", fetchError);
      throw new Error("Customer not found");
    }

    // Step 2: Delete the auth user if auth_id exists
    if (customerData?.auth_id) {
      const { error: authError } = await supabase.auth.admin.deleteUser(
        customerData.auth_id
      );

      if (authError) {
        console.error("Failed to delete auth user:", authError);
        // Continue with customer deletion even if auth deletion fails
        // (orphaned auth user is less critical than orphaned customer record)
      }
    }

    // Step 3: Delete the customer record
    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);
      
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove customer:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove customer" },
      { status: 500 }
    );
  }
}
