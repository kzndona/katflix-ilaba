import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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
          { error: "productData is required" },
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
        { error: "item_name is required" },
        { status: 400 }
      );
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
        { error: "Failed to save product" },
        { status: 500 }
      );
    }

    // Handle image upload if provided
    if (imageFile && isNewProduct) {
      // Only upload image for new products that just got an ID
      // Validate file
      if (imageFile.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size must be under 2MB" },
          { status: 400 }
        );
      }

      if (!imageFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "File must be an image" },
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
          { error: `Failed to upload image: ${uploadError.message}` },
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
          { error: "Failed to update product with image" },
          { status: 500 }
        );
      }

      // Update savedProduct with image URL
      savedProduct.image_url = publicUrl.publicUrl;
    }

    return NextResponse.json(savedProduct);
  } catch (error) {
    console.error("Failed to save products:", error);
    return NextResponse.json(
      { error: "Failed to save products" },
      { status: 500 }
    );
  }
}
