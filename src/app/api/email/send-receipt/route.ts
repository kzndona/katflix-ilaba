import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { formatReceiptAsPlaintext, CompactReceipt } from "@/src/app/in/pos/logic/receiptGenerator";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/email/send-receipt
 * 
 * Sends order receipt via email using Resend
 * 
 * REQUEST BODY:
 * {
 *   email: string,
 *   orderId: string,
 *   receipt: CompactReceipt,
 *   customerName?: string
 * }
 * 
 * RESPONSE:
 * {
 *   success: true,
 *   message: string,
 *   email: string,
 *   orderId: string,
 *   emailId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, orderId, receipt, customerName } = await request.json();

    // ========== VALIDATION ==========
    if (!email || !orderId || !receipt) {
      return NextResponse.json(
        { error: "Email, orderId, and receipt are required" },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // ========== GENERATE RECEIPT TEXT ==========
    const receiptText = formatReceiptAsPlaintext(receipt);

    // ========== BUILD EMAIL ==========
    const greeting = customerName ? `Hi ${customerName.split(" ")[0]}!` : "Hi there!";
    
    const emailContent = `
${greeting}

Thank you for your order! Here's your receipt:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${receiptText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Order ID: ${orderId}

Your order is being processed. We'll notify you when it's ready!

Best regards,
KATFLIX Team
    `.trim();

    // ========== SEND EMAIL ==========
    const result = await resend.emails.send({
      from: "noreply@katflix.com", // Update this to your verified sender domain in Resend
      to: email,
      subject: `Receipt for Order ${orderId}`,
      text: emailContent,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>${greeting}</h2>
              <p>Thank you for your order! Here's your receipt:</p>
              
              <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0; background-color: #f9f9f9; font-family: monospace; white-space: pre-wrap;">
${receiptText}
              </div>

              <p><strong>📦 Order ID:</strong> ${orderId}</p>
              <p>Your order is being processed. We'll notify you when it's ready!</p>

              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="text-align: center; color: #666; font-size: 12px;">
                Best regards,<br />
                <strong>KATFLIX Team</strong>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    // ========== HANDLE RESPONSE ==========
    if (result.error) {
      console.error("❌ Resend email error:", result.error);
      return NextResponse.json(
        { error: `Failed to send email: ${result.error.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Receipt email sent to ${email} (Order: ${orderId})`);

    return NextResponse.json(
      {
        success: true,
        message: "Receipt email sent successfully",
        email,
        orderId,
        emailId: result.data?.id,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Email receipt error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send receipt email" },
      { status: 500 }
    );
  }
}
