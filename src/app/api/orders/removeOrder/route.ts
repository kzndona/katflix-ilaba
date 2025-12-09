import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, get all order products to restore inventory
    const { data: orderProducts, error: fetchErr } = await supabase
      .from("order_products")
      .select("product_id, quantity")
      .eq("order_id", id);

    if (fetchErr) {
      console.error("Failed to fetch order products:", fetchErr);
      throw new Error("Failed to fetch order products");
    }

    // Restore inventory for each product
    if (orderProducts && orderProducts.length > 0) {
      for (const op of orderProducts) {
        // Get current product quantity
        const { data: product, error: productFetchErr } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", op.product_id)
          .single();

        if (productFetchErr) {
          console.error(`Failed to fetch product ${op.product_id}:`, productFetchErr);
          // Continue anyway - product might have been deleted
          continue;
        }

        if (product) {
          const currentQty = Number(product.quantity);
          const returnQty = Number(op.quantity);
          const newQty = currentQty + returnQty;

          // Update product quantity
          const { error: updateErr } = await supabase
            .from("products")
            .update({ 
              quantity: newQty,
              last_updated: new Date().toISOString()
            })
            .eq("id", op.product_id);

          if (updateErr) {
            console.error(`Failed to restore inventory for product ${op.product_id}:`, updateErr);
            // Continue anyway to complete the deletion
          }
        }
      }
    }

    // Delete the order (cascade will delete order_products, baskets, etc.)
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove a order:", error);
    return NextResponse.json({ error: "Failed to remove a order" }, { status: 500 });
  }
}
