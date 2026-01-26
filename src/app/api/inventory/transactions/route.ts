import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * POST /api/inventory/transactions
 * 
 * Record inventory transaction (stock adjustment, order deduction, etc)
 * Includes automatic stock level update
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Validate required fields
    if (!body.product_id) {
      return NextResponse.json(
        { success: false, error: "product_id required" },
        { status: 400 }
      );
    }

    if (typeof body.quantity_change !== "number") {
      return NextResponse.json(
        { success: false, error: "quantity_change required (number)" },
        { status: 400 }
      );
    }

    // Step 1: Get current product quantity
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, quantity")
      .eq("id", body.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const currentQty = product.quantity || 0;
    const newQty = Math.max(0, currentQty + body.quantity_change);

    // Step 2: Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from("product_transactions")
      .insert({
        product_id: body.product_id,
        order_id: body.order_id || null,
        quantity_change: body.quantity_change,
        transaction_type: body.transaction_type || "adjustment", // order, adjustment, return
        notes: body.notes || null,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (txError) {
      console.error("Transaction creation error:", txError);
      return NextResponse.json(
        { success: false, error: "Failed to record transaction" },
        { status: 500 }
      );
    }

    // Step 3: Update product quantity
    const { error: updateError } = await supabase
      .from("products")
      .update({ quantity: newQty })
      .eq("id", body.product_id);

    if (updateError) {
      console.error("Stock update error:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update stock" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
      previous_quantity: currentQty,
      new_quantity: newQty,
      product_id: body.product_id,
    });
  } catch (error) {
    console.error("Inventory transaction error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/transactions
 * 
 * Get transaction history for a product
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "product_id query parameter required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: transactions, error } = await supabase
      .from("product_transactions")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product_id: productId,
      transaction_count: transactions?.length || 0,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get transactions",
      },
      { status: 500 }
    );
  }
}
