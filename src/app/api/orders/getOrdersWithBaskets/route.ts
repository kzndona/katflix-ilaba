import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        source,
        customer_id,
        status,
        total_amount,
        order_note,
        created_at,
        completed_at,
        handling,
        breakdown,
        gcash_receipt_url,
        customers (
          id,
          first_name,
          last_name,
          email_address,
          phone_number
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
