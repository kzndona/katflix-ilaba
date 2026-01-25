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

// Helper: Right-align amount on a line with max width of 40 chars
function formatReceiptLine(label: string, amount?: number, maxWidth: number = 40): string {
  if (amount === undefined) {
    // Just a label line
    return label;
  }

  const amountStr = `₱${amount.toFixed(2)}`;
  const availableSpace = maxWidth - amountStr.length;
  
  // Truncate label if it's too long
  const truncatedLabel = label.length > availableSpace ? label.substring(0, availableSpace - 1) : label;
  const padding = availableSpace - truncatedLabel.length;

  return truncatedLabel + " ".repeat(Math.max(1, padding)) + amountStr;
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

  // === HEADER ===
  receipt += "=".repeat(40) + "\n";
  receipt += " ".repeat(12) + "KATFLIX\n";
  receipt += " ".repeat(9) + "Laundry Services\n";
  receipt += "=".repeat(40) + "\n";
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
      const total = item.subtotal || 0;

      receipt += `${item.product_name} x${qty}\n`;
      receipt += "  " + formatReceiptLine(item.product_name, total, 36) + "\n";
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
      const basketName = `Basket ${basket.basket_number}`;
      const weight = basket.weight ? `${basket.weight}kg` : "";
      const basketTotal = basket.total || 0;

      receipt += `${basketName}`;
      if (weight) {
        receipt += ` • ${weight}`;
      }
      receipt += `\n`;

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
  receipt += "-".repeat(40) + "\n";
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
  receipt += "=".repeat(40) + "\n";
  receipt += formatReceiptLine("TOTAL", totalAmount, 40) + "\n";
  receipt += "=".repeat(40) + "\n";
  receipt += "\n";

  // === PAYMENT INFO ===
  const paymentMethod = breakdown.payment?.method || "CASH";
  receipt += formatReceiptLine("Payment", undefined, 40) + " " + paymentMethod.toUpperCase() + "\n";

  if (breakdown.payment?.amount_paid) {
    const amountPaid = breakdown.payment.amount_paid;
    receipt += formatReceiptLine("Amount Paid", amountPaid, 40) + "\n";
    const change = amountPaid - totalAmount;
    if (paymentMethod.toUpperCase() === "CASH" && change >= 0) {
      receipt += formatReceiptLine("Change", change, 40) + "\n";
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
  // Wrap Order ID on next line to prevent overflow
  receipt += `Order ID:\n  ${orderId}\n`;

  receipt += "\n";
  receipt += "=".repeat(40) + "\n";
  receipt += " ".repeat(14) + "Thank you!\n";
  receipt += " ".repeat(11) + "Come again!\n";
  receipt += "\n";

  console.log("✅ [Receipt] Receipt string generated successfully", {
    receiptLength: receipt.length,
    hasContent: receipt.trim().length > 0,
    lines: receipt.split("\n").length,
  });

  return receipt;
}
