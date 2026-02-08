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
  console.log("🔄 [Receipt] Starting receipt generation for orderId:", orderId);
  
  const supabase = createClient();

  // Fetch order with all related data
  console.log("🔄 [Receipt] Fetching order from database...");
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
        last_name
      )
      `
    )
    .eq("id", orderId)
    .single();

  if (orderError) {
    console.error("❌ [Receipt] Database fetch error:", orderError);
    throw new Error(`Failed to fetch order: ${orderError.message}`);
  }

  if (!orderData) {
    console.error("❌ [Receipt] No order data returned");
    throw new Error("Order not found");
  }

  console.log("✅ [Receipt] Order fetched successfully:", {
    orderId: orderData.id,
    customerId: orderData.customer_id,
    cashierId: orderData.cashier_id,
    totalAmount: orderData.total_amount,
    hasBreakdown: !!orderData.breakdown,
    hasHandling: !!orderData.handling,
  });

  // Extract customer and staff info
  const customer = orderData.customers || {};
  const staff = orderData.staff || {};
  const breakdown = orderData.breakdown || {};
  const handling = orderData.handling || {};
  const timestamp = orderData.created_at;

  console.log("📋 [Receipt] Extracted data:", {
    customerName: `${customer.first_name} ${customer.last_name}`,
    staffName: `${staff.first_name} ${staff.last_name}`,
    breakdownKeys: Object.keys(breakdown),
    handlingKeys: Object.keys(handling),
  });

  // Generate plaintext receipt
  console.log("🖨️ [Receipt] Formatting plaintext receipt...");
  const plaintext = formatReceiptAsPlaintext(
    orderId,
    timestamp,
    customer,
    breakdown,
    handling,
    staff,
    orderData.total_amount
  );

  console.log("✅ [Receipt] Plaintext receipt formatted successfully", {
    contentLength: plaintext.length,
    hasContent: plaintext.trim().length > 0,
  });

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

// Helper: Ensure line doesn't exceed max width by truncation
function truncateLine(text: string, maxWidth: number = 40): string {
  if (text.length > maxWidth) {
    return text.substring(0, maxWidth);
  }
  return text;
}

// Helper: Right-align amount on a line with max width of 40 chars
function formatReceiptLine(label: string, amount?: number, maxWidth: number = 40): string {
  if (amount === undefined) {
    // Just a label line - still truncate it
    return truncateLine(label, maxWidth);
  }

  const amountStr = `₱${amount.toFixed(2)}`;
  const amountWidth = amountStr.length;
  const availableForLabel = maxWidth - amountWidth;
  
  // Truncate label if it's too long
  const truncatedLabel = label.length > availableForLabel ? label.substring(0, availableForLabel - 1) : label;
  const padding = availableForLabel - truncatedLabel.length;

  const line = truncatedLabel + " ".repeat(Math.max(1, padding)) + amountStr;
  return truncateLine(line, maxWidth);
}

function formatReceiptAsPlaintext(
  orderId: string,
  timestamp: string,
  customer: any,
  breakdown: any,
  handling: any,
  staff: any,
  totalAmount: number
): string {
  console.log("📝 [Receipt] formatReceiptAsPlaintext called with:", {
    orderId,
    timestamp,
    customerKeys: Object.keys(customer),
    breakdownKeys: Object.keys(breakdown),
    handlingKeys: Object.keys(handling),
    staffKeys: Object.keys(staff),
    totalAmount,
  });
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

  // Extract breakdown items and baskets (separate arrays in breakdown)
  const items = breakdown.items || [];
  const baskets = breakdown.baskets || [];
  
  console.log("🔍 [Receipt] Full breakdown structure:", {
    breakdown,
    itemsCount: items.length,
    basketsCount: baskets.length,
  });

  const productItems = items.filter((i: any) => i.type === "product");
  const basketItems = baskets;

  console.log("📦 [Receipt] Extracted items:", {
    totalItems: items.length,
    productItems: productItems.length,
    basketItems: basketItems.length,
    itemsStructure: items.slice(0, 2), // Log first 2 items for structure
  });

  // Fees and totals
  const fees = breakdown.fees || [];
  const serviceFee = fees.find((f: any) => f.type === "service_fee")?.amount || 0;
  const handlingFee = fees.find((f: any) => f.type === "handling_fee")?.amount || 0;
  // VAT is stored in summary, not in fees array
  const summary = breakdown.summary || {};
  const taxes = summary.vat_amount || 0;

  console.log("💰 [Receipt] Extracted fees:", {
    serviceFee,
    handlingFee,
    taxes,
    feesCount: fees.length,
  });

  const productSubtotal = productItems.reduce((sum: number, i: any) => sum + i.lineTotal, 0);
  const basketSubtotal = basketItems.reduce((sum: number, i: any) => sum + (i.total || i.lineTotal), 0);
  const subtotal = productSubtotal + basketSubtotal;

  console.log("📊 [Receipt] Calculated totals:", {
    productSubtotal,
    basketSubtotal,
    subtotal,
    totalAmount,
  });

  // Build receipt
  let receipt = "";
  
  // Extract short order ID (before first hyphen)
  const shortOrderId = orderId.split("-")[0].toUpperCase();

  // === HEADER ===
  receipt += truncateLine("=".repeat(40), 40) + "\n";
  receipt += truncateLine(" ".repeat(12) + "KATFLIX", 40) + "\n";
  receipt += truncateLine(" ".repeat(9) + "Laundry Services", 40) + "\n";
  receipt += truncateLine("=".repeat(40), 40) + "\n";
  receipt += "\n";

  // === ORDER & CUSTOMER INFO ===
  receipt += truncateLine(`ORDER: ${shortOrderId}`, 40) + "\n";
  receipt += truncateLine(`${dateStr}, ${timeStr}`, 40) + "\n";
  receipt += truncateLine(`Customer: ${customerName || "Walk-in"}`, 40) + "\n";
  if (customerPhone) {
    receipt += truncateLine(`Phone: ${customerPhone}`, 40) + "\n";
  }
  receipt += truncateLine("-".repeat(40), 40) + "\n";
  receipt += "\n";

  // === PRODUCTS (if any) ===
  if (productItems.length > 0) {
    for (const item of productItems) {
      const qty = item.quantity || 1;
      const total = item.subtotal || 0;

      receipt += truncateLine(`${item.product_name} x${qty}`, 40) + "\n";
      receipt += formatReceiptLine(`  ${item.product_name}`, total, 40) + "\n";
      receipt += "\n";
    }

    if (basketItems.length > 0) {
      receipt += truncateLine("-".repeat(40), 40) + "\n";
      receipt += "\n";
    }
  }

  // === BASKETS WITH SERVICES ===
  if (basketItems.length > 0) {
    for (const basket of basketItems) {
      const basketName = `Basket ${basket.basket_number}`;
      const weight = basket.weight ? `${basket.weight}kg` : "";
      const basketTotal = basket.total || 0;

      let basketHeader = basketName;
      if (weight) {
        basketHeader += ` • ${weight}`;
      }
      receipt += truncateLine(basketHeader, 40) + "\n";

      // Services breakdown from basket.services array
      if (basket.services && Array.isArray(basket.services)) {
        for (const service of basket.services) {
          const serviceName = service.service_name || "Service";
          const isPremium = service.is_premium || false;
          const servicePrice = service.subtotal || 0;
          
          const serviceLabel = `  ${serviceName}${isPremium ? " (Premium)" : ""}`;
          receipt += formatReceiptLine(serviceLabel, servicePrice, 40) + "\n";
        }
      }

      const subtotalLabel = `  Subtotal (Basket ${basket.basket_number})`;
      receipt += formatReceiptLine(subtotalLabel, basketTotal, 40) + "\n";
      receipt += "\n";
    }
  }

  // === TOTALS ===
  receipt += truncateLine("-".repeat(40), 40) + "\n";
  receipt += "\n";
  receipt += formatReceiptLine("Subtotal", subtotal, 40) + "\n";
  if (serviceFee > 0) {
    receipt += formatReceiptLine("Service Fee", serviceFee, 40) + "\n";
  }
  if (handlingFee > 0) {
    receipt += formatReceiptLine("Handling Fee", handlingFee, 40) + "\n";
  }
  if (taxes > 0) {
    receipt += formatReceiptLine("Tax (VAT)", taxes, 40) + "\n";
  }
  receipt += truncateLine("=".repeat(40), 40) + "\n";
  receipt += formatReceiptLine("TOTAL", totalAmount, 40) + "\n";
  receipt += truncateLine("=".repeat(40), 40) + "\n";
  receipt += "\n";

  // === PAYMENT INFO ===
  const paymentMethod = breakdown.payment?.method || "CASH";
  receipt += truncateLine(`Payment: ${paymentMethod.toUpperCase()}`, 40) + "\n";

  if (breakdown.payment?.amount_paid) {
    const amountPaid = breakdown.payment.amount_paid;
    receipt += formatReceiptLine("Amount Paid", amountPaid, 40) + "\n";
    const change = amountPaid - totalAmount;
    if (paymentMethod.toUpperCase() === "CASH" && change >= 0) {
      receipt += formatReceiptLine("Change", change, 40) + "\n";
    }
  }

  receipt += "\n";
  receipt += truncateLine("-".repeat(40), 40) + "\n";

  // === HANDLING INFO ===
  if (handling.pickup?.status === "pending" || handling.delivery?.status === "pending") {
    receipt += "\n";
    if (handling.delivery?.status === "pending") {
      receipt += truncateLine("DELIVERY", 40) + "\n";
      if (handling.delivery?.address) {
        receipt += truncateLine(`Address: ${handling.delivery.address}`, 40) + "\n";
      }
      if (handling.delivery?.fee > 0) {
        receipt += truncateLine(`Fee: ₱${handling.delivery.fee.toFixed(2)}`, 40) + "\n";
      }
    } else if (handling.pickup?.status === "pending") {
      receipt += truncateLine("PICKUP AT STORE", 40) + "\n";
    }
    receipt += "\n";
  }

  // === CASHIER & META INFO ===
  if (staff?.first_name || staff?.last_name) {
    const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim();
    receipt += truncateLine(`Cashier: ${staffName}`, 40) + "\n";
  }

  receipt += truncateLine(`Source: ${breakdown.source || "Store"}`, 40) + "\n";
  receipt += truncateLine(`Order ID: ${shortOrderId}`, 40) + "\n";

  receipt += "\n";
  receipt += truncateLine("=".repeat(40), 40) + "\n";
  receipt += truncateLine(" ".repeat(14) + "Thank you!", 40) + "\n";
  receipt += truncateLine(" ".repeat(11) + "Come again!", 40) + "\n";
  receipt += "\n";

  console.log("✅ [Receipt] Receipt string generated successfully", {
    receiptLength: receipt.length,
    hasContent: receipt.trim().length > 0,
    lines: receipt.split("\n").length,
  });

  return receipt;
}
