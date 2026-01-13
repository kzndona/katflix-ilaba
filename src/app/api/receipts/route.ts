import { jsPDF } from "jspdf";
import { CompactReceipt, ReceiptItem, formatReceiptAsPlaintext } from "@/src/app/in/pos/logic/receiptGenerator";
import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * POST /api/receipts
 * Generates plaintext receipt and saves to server
 * Body: { receipt: CompactReceipt, orderId: string }
 * Response: { success: true, downloadUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { receipt, orderId } = await request.json();

    if (!receipt || !orderId) {
      return NextResponse.json(
        { error: "Receipt and orderId required" },
        { status: 400 }
      );
    }

    // Generate plaintext receipt
    const plaintext = formatReceiptAsPlaintext(receipt);

    // Save to server
    const receiptsDir = path.join(process.cwd(), "public", "receipts");

    // Create directory if it doesn't exist
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `receipt-${timestamp}.txt`;
    const filepath = path.join(receiptsDir, filename);

    fs.writeFileSync(filepath, plaintext, "utf-8");

    const downloadUrl = `/receipts/${filename}`;

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename,
      orderId,
    });
  } catch (error) {
    console.error("Receipt generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate receipt" },
      { status: 500 }
    );
  }
}
