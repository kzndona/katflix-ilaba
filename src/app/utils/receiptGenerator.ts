/**
 * Receipt Generator (Frontend Utility)
 * Generates plaintext receipts from database order records
 * Can be called anytime to regenerate/reprint receipts
 * 
 * Usage: const receipt = await generateReceiptFromDB(orderId);
 */

import { createClient } from "@/src/app/utils/supabase/client";

export interface ReceiptData {
  plaintext: string;
  orderId: string;
  timestamp: string;
}

/**
 * Fetch order from DB and generate plaintext receipt
 * Used by POS after successful order creation, and for reprint functionality
 */
export async function generateReceiptFromDB(orderId: string): Promise<ReceiptData> {
  const supabase = createClient();

  // Fetch order with all related data
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers:customer_id (
        id,
        first_name,
        last_name,
        phone_number,
        email_address
      ),
      staff:cashier_id (
        id,
        first_name,
        last_name,
        position
      )
      `
    )
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    throw new Error(`Failed to fetch order: ${orderError?.message || "Order not found"}`);
  }

  // Extract customer and staff info
  const customer = orderData.customers || {};
  const staff = orderData.staff || {};
  const breakdown = orderData.breakdown || {};
  const handling = orderData.handling || {};
  const timestamp = orderData.created_at;

  // Generate plaintext receipt
  const plaintext = formatReceiptAsPlaintext(
    orderId,
    timestamp,
    customer,
    breakdown,
    handling,
    staff,
    orderData.total_amount
  );

  return {
    plaintext,
    orderId,
    timestamp,
  };
}

/**
 * Format order data as plaintext receipt for thermal printer
 * 80mm width optimized, plain text suitable for all printers
 */
function formatReceiptAsPlaintext(
  orderId: string,
  timestamp: string,
  customer: any,
  breakdown: any,
  handling: any,
  staff: any,
  totalAmount: number
): string {
  const orderDate = new Date(timestamp);
  const dateStr = orderDate.toLocaleDateString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = orderDate.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  const customerPhone = customer.phone_number || "";

  // Extract breakdown items (products, baskets with services)
  const items = breakdown.items || [];
  const productItems = items.filter((i: any) => i.type === "product");
  const basketItems = items.filter((i: any) => i.type === "basket");

  // Fees and totals
  const fees = breakdown.fees || [];
  const serviceFee = fees.find((f: any) => f.type === "service_fee")?.amount || 0;
  const handlingFee = fees.find((f: any) => f.type === "handling_fee")?.amount || 0;
  const taxes = fees.find((f: any) => f.type === "tax")?.amount || 0;

  const productSubtotal = productItems.reduce((sum: number, i: any) => sum + i.lineTotal, 0);
  const basketSubtotal = basketItems.reduce((sum: number, i: any) => sum + (i.total || i.lineTotal), 0);
  const subtotal = productSubtotal + basketSubtotal;

  // Build receipt
  let receipt = "";

  // === HEADER ===
  receipt += " ".repeat(12) + "=====================================\n";
  receipt += " ".repeat(18) + "KATFLIX\n";
  receipt += " ".repeat(13) + "Laundry Services\n";
  receipt += " ".repeat(12) + "=====================================\n";
  receipt += "\n";

  // === ORDER & CUSTOMER INFO ===
  receipt += `ORDER: ${orderId.substring(0, 8).toUpperCase()}\n`;
  receipt += `${dateStr}, ${timeStr}\n`;
  receipt += `Customer: ${customerName || "Walk-in"}\n`;
  if (customerPhone) {
    receipt += `Phone: ${customerPhone}\n`;
  }
  receipt += "-".repeat(40) + "\n";
  receipt += "\n";

  // === PRODUCTS (if any) ===
  if (productItems.length > 0) {
    for (const item of productItems) {
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const total = item.lineTotal || 0;

      receipt += `${item.name} x${qty}\n`;
      receipt += `  Price: ${" ".repeat(Math.max(0, 29 - item.name.length - 3))}₱${total.toFixed(2)}\n`;
      receipt += "\n";
    }

    if (basketItems.length > 0) {
      receipt += "-".repeat(40) + "\n";
      receipt += "\n";
    }
  }

  // === BASKETS WITH SERVICES ===
  if (basketItems.length > 0) {
    for (const basket of basketItems) {
      const basketName = basket.name || "Service";
      const weight = basket.details || "";
      const basketTotal = basket.total || basket.lineTotal || 0;

      receipt += `${basketName}\n`;
      if (weight) {
        receipt += `  ${weight}\n`;
      }

      // Services breakdown
      if (basket.breakdown && typeof basket.breakdown === "object") {
        for (const [serviceName, amount] of Object.entries(basket.breakdown)) {
          if (amount && (amount as number) > 0) {
            const displayName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
            const isPremium = basket.premiumFlags && basket.premiumFlags[serviceName];
            receipt += `  ${displayName}${isPremium ? " (Premium)" : ""}\n`;
            receipt += `    Price: ${" ".repeat(20)}₱${(amount as number).toFixed(2)}\n`;
          }
        }
      }

      receipt += `  Subtotal: ${" ".repeat(25)}₱${basketTotal.toFixed(2)}\n`;
      receipt += "\n";
    }
  }

  // === TOTALS ===
  receipt += "-".repeat(40) + "\n";
  receipt += "\n";
  receipt += `Subtotal: ${" ".repeat(28)}₱${subtotal.toFixed(2)}\n`;
  if (serviceFee > 0) {
    receipt += `Service Fee: ${" ".repeat(25)}₱${serviceFee.toFixed(2)}\n`;
  }
  if (handlingFee > 0) {
    receipt += `Handling Fee: ${" ".repeat(24)}₱${handlingFee.toFixed(2)}\n`;
  }
  if (taxes > 0) {
    receipt += `Tax (VAT): ${" ".repeat(27)}₱${taxes.toFixed(2)}\n`;
  }
  receipt += "=".repeat(40) + "\n";
  receipt += `TOTAL: ${" ".repeat(32)}₱${totalAmount.toFixed(2)}\n`;
  receipt += "=".repeat(40) + "\n";
  receipt += "\n";

  // === PAYMENT INFO ===
  const paymentMethod = breakdown.payment?.method || "CASH";
  receipt += `Payment: ${" ".repeat(30)}${paymentMethod.toUpperCase()}\n`;

  if (breakdown.payment?.amount_paid) {
    const amountPaid = breakdown.payment.amount_paid;
    const change = amountPaid - totalAmount;
    receipt += `Amount Paid: ${" ".repeat(26)}₱${amountPaid.toFixed(2)}\n`;
    if (paymentMethod.toUpperCase() === "CASH" && change >= 0) {
      receipt += `Change: ${" ".repeat(31)}₱${change.toFixed(2)}\n`;
    }
  }

  receipt += "\n";
  receipt += "-".repeat(40) + "\n";

  // === HANDLING INFO ===
  if (handling.pickup?.status === "pending" || handling.delivery?.status === "pending") {
    receipt += "\n";
    if (handling.delivery?.status === "pending") {
      receipt += "DELIVERY\n";
      if (handling.delivery?.address) {
        receipt += `Address: ${handling.delivery.address}\n`;
      }
      if (handling.delivery?.fee > 0) {
        receipt += `Fee: ₱${handling.delivery.fee.toFixed(2)}\n`;
      }
    } else if (handling.pickup?.status === "pending") {
      receipt += "PICKUP AT STORE\n";
    }
    receipt += "\n";
  }

  // === CASHIER & META INFO ===
  if (staff?.first_name || staff?.last_name) {
    const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim();
    receipt += `Cashier: ${staffName}\n`;
  }

  receipt += `Source: ${breakdown.source || "Store"}\n`;
  receipt += `Order ID: ${orderId}\n`;

  receipt += "\n";
  receipt += "=".repeat(40) + "\n";
  receipt += " ".repeat(14) + "Thank you!\n";
  receipt += " ".repeat(11) + "Come again!\n";
  receipt += "\n";

  return receipt;
}
