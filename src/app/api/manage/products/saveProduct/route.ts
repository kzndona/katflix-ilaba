import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // Always use service role key to bypass RLS policies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Check if request is FormData (with image) or JSON
    const contentType = req.headers.get("content-type");
    let productData: any;
    let imageFile: File | null = null;

    if (contentType?.includes("multipart/form-data")) {
      // Handle FormData (product + optional image)
      const formData = await req.formData();
      const productJsonStr = formData.get("productData") as string | null;
      imageFile = formData.get("file") as File | null;

      if (!productJsonStr) {
        return NextResponse.json(
          { success: false, error: "productData is required" },
          { status: 400 }
        );
      }

      productData = JSON.parse(productJsonStr);
    } else {
      // Handle JSON request (backward compatibility for edits without image)
      productData = await req.json();
    }

    // Validate required fields
    if (!productData.item_name) {
      return NextResponse.json(
        { success: false, error: "item_name is required" },
        { status: 400 }
      );
    }

    // Convert string numbers to proper numeric types
    if (productData.unit_price) {
      productData.unit_price = parseFloat(productData.unit_price);
    }
    if (productData.unit_cost) {
      productData.unit_cost = parseFloat(productData.unit_cost);
    }
    if (productData.quantity) {
      productData.quantity = parseFloat(productData.quantity);
    }
    if (productData.reorder_level) {
      productData.reorder_level = parseFloat(productData.reorder_level);
    }

    let result: any;
    let isNewProduct = !productData.id;

    // Save product (insert or update)
    if (isNewProduct) {
      // Remove id field for insert
      const { id, ...dataToInsert } = productData;
      result = await supabase.from("products").insert(dataToInsert).select();
    } else {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", productData.id)
        .select();
    }

    if (result.error) throw result.error;

    const savedProduct = result.data?.[0];
    if (!savedProduct) {
      return NextResponse.json(
        { success: false, error: "Failed to save product" },
        { status: 500 }
      );
    }

    // Handle image upload if provided
    if (imageFile && isNewProduct) {
      // Only upload image for new products that just got an ID
      // Validate file
      if (imageFile.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "File size must be under 2MB" },
          { status: 400 }
        );
      }

      if (!imageFile.type.startsWith("image/")) {
        return NextResponse.json(
          { success: false, error: "File must be an image" },
          { status: 400 }
        );
      }

      const buffer = await imageFile.arrayBuffer();
      const filename = `${savedProduct.id}-${Date.now()}.${imageFile.name.split(".").pop()}`;
      const filePath = filename;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, buffer, {
          contentType: imageFile.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return NextResponse.json(
          { success: false, error: `Failed to upload image: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      // Update product with image URL
      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: publicUrl.publicUrl })
        .eq("id", savedProduct.id);

      if (updateError) {
        console.error("Database update error:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update product with image" },
          { status: 500 }
        );
      }

      // Update savedProduct with image URL
      savedProduct.image_url = publicUrl.publicUrl;
    }

    return NextResponse.json({ success: true, data: savedProduct });
  } catch (error) {
    console.error("Failed to save product:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save product" },
      { status: 500 }
    );
  }
}
