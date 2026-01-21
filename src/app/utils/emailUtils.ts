import { CompactReceipt } from "@/src/app/in/pos/logic/receiptGenerator";

/**
 * Send order receipt via email
 * 
 * Usage:
 * ```typescript
 * await sendReceiptEmail({
 *   email: customer.email_address,
 *   orderId: order.id,
 *   receipt: compactReceipt,
 *   customerName: `${customer.first_name} ${customer.last_name}`
 * });
 * ```
 */
export async function sendReceiptEmail({
  email,
  orderId,
  receipt,
  customerName,
}: {
  email: string;
  orderId: string;
  receipt: CompactReceipt;
  customerName?: string;
}) {
  try {
    const response = await fetch("/api/email/send-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        orderId,
        receipt,
        customerName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn(`⚠️ Failed to send receipt email to ${email}:`, result.error);
      return {
        success: false,
        error: result.error,
      };
    }

    console.log(`✅ Receipt email sent to ${email}`);
    return {
      success: true,
      emailId: result.emailId,
    };
  } catch (error: any) {
    console.warn(`⚠️ Error sending receipt email:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
