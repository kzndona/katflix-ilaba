/**
 * GET /api/gcash-receipt/[filename]
 * 
 * Proxy endpoint to fetch GCash receipt images from Supabase Storage
 * Bypasses CORS issues by serving through backend
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  console.log("[GCASH RECEIPT PROXY] Fetching:", filename);

  try {
    const supabase = await createClient();

    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from("gcash-receipts")
      .download(filename);

    if (error || !data) {
      console.error("[GCASH RECEIPT] Download error:", error);
      return new NextResponse("File not found", { status: 404 });
    }

    // Detect content type from file extension
    let contentType = "image/jpeg";
    const filename_lower = filename.toLowerCase();
    
    if (filename_lower.endsWith(".heic") || filename_lower.endsWith(".heif")) {
      contentType = "image/heic";
    } else if (filename_lower.endsWith(".png")) {
      contentType = "image/png";
    } else if (filename_lower.endsWith(".gif")) {
      contentType = "image/gif";
    } else if (filename_lower.endsWith(".webp")) {
      contentType = "image/webp";
    }

    // Convert blob to array buffer and then to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log("[GCASH RECEIPT PROXY] Returning image, size:", uint8Array.length, "type:", contentType);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": uint8Array.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("[GCASH RECEIPT] Proxy error:", error);
    return new NextResponse("Error fetching receipt", { status: 500 });
  }
}
