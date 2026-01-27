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

    console.log("[GCASH RECEIPT PROXY] Download result:", {
      success: !error,
      error: error?.message,
      dataType: data?.type,
      dataSize: data?.size,
    });

    if (error || !data) {
      console.error("[GCASH RECEIPT] Download error:", error);
      return NextResponse.json(
        { error: `Receipt not found: ${error?.message || "Unknown error"}` },
        { status: 404 }
      );
    }

    // Convert blob to buffer
    const buffer = await data.arrayBuffer();

    console.log("[GCASH RECEIPT PROXY] Returning image, size:", buffer.byteLength);

    // Return image with proper CORS headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[GCASH RECEIPT] Proxy error:", error);
    return NextResponse.json(
      { error: `Failed to fetch receipt: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
