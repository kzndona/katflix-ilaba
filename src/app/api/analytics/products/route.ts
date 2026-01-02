import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("item_name");

    if (productsError) throw productsError;

    // Separate into low-stock and normal stock
    const lowStockProducts: Array<{
      id: string;
      name: string;
      quantity: number;
      reorderLevel: number;
      unitPrice: number;
    }> = [];
    const allProducts: Array<{
      id: string;
      name: string;
      quantity: number;
      reorderLevel: number;
      unitPrice: number;
    }> = [];

    products?.forEach((product: any) => {
      const item = {
        id: product.id,
        name: product.item_name,
        quantity: parseFloat(product.quantity || 0),
        reorderLevel: parseFloat(product.reorder_level || 0),
        unitPrice: parseFloat(product.unit_price || 0),
      };

      allProducts.push(item);

      if (item.quantity < item.reorderLevel) {
        lowStockProducts.push(item);
      }
    });

    return NextResponse.json({
      lowStockProducts,
      allProducts,
      totalProducts: allProducts.length,
      lowStockCount: lowStockProducts.length,
    });
  } catch (error) {
    console.error("Error fetching products analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch products analytics" },
      { status: 500 }
    );
  }
}
