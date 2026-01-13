import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing startDate or endDate" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all product transactions in the date range
    const endDatePlusOne = new Date(new Date(endDate).getTime() + 86400000)
      .toISOString()
      .split("T")[0];

    const { data: transactions, error: transactionsError } = await supabase
      .from("product_transactions")
      .select(
        `
        id,
        created_at,
        change_type,
        quantity,
        products (
          item_name,
          unit_cost
        )
      `
      )
      .gte("created_at", startDate)
      .lt("created_at", endDatePlusOne);

    if (transactionsError) throw transactionsError;

    // Transform into transaction format for accounting
    const productTransactions = (transactions || []).map((tx: any) => ({
      date: tx.created_at,
      productName: tx.products?.item_name || "Unknown Product",
      quantity: parseFloat(tx.quantity || 0),
      totalCost: parseFloat(tx.quantity || 0) * parseFloat(tx.products?.unit_cost || 0),
      type: tx.change_type,
    }));

    return NextResponse.json(productTransactions);
  } catch (error) {
    console.error("Error fetching product transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch product transactions" },
      { status: 500 }
    );
  }
}
