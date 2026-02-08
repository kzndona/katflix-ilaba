/**
 * Receipt Generator
 * Formats order data as plaintext receipt for thermal printer
 * Works with POS order creation endpoint response
 */

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface BasketData {
  basket_number: number;
  weight_kg: number;
  subtotal: number;
  services?: {
    wash?: string;
    wash_pricing?: { base_price: number; name?: string };
    dry?: string;
    dry_pricing?: { base_price: number; name?: string };
    spin?: boolean;
    spin_pricing?: { base_price: number; name?: string };
    iron_weight_kg?: number;
    iron_pricing?: { base_price: number; name?: string };
    plastic_bags?: number;
    additional_dry_time_minutes?: number;
    additional_dry_time_pricing?: { base_price: number; name?: string };
    staff_service_pricing?: { base_price: number; name?: string };
  };
}

export interface CompactReceipt {
  orderId: string;
  customerName: string;
  items: ReceiptItem[];
  baskets?: BasketData[];
  subtotal?: number;
  total: number;
  timestamp: string;
  paymentMethod?: string;
  notes?: string;
  summary?: {
    subtotal_products?: number;
    subtotal_services?: number;
    staff_service_fee?: number;
    delivery_fee?: number;
    vat_amount?: number;
    loyalty_discount?: number;
  };
  change?: number;
}

/**
 * Helper: Truncate text to max width
 */
function truncateLine(text: string, maxWidth: number = 40): string {
  if (text.length > maxWidth) {
    return text.substring(0, maxWidth);
  }
  return text;
}

/**
 * Helper: Format product item with name and price
 * If product name is long, split across 2 lines:
 * - Line 1: First part of product name only
 * - Line 2: Remaining name (with "...") + qty/price right-aligned at column 40
 */
function formatProductLine(productName: string, quantity: number, unitPrice: number, subtotal: number, maxWidth: number = 40): string[] {
  const qtyPriceStr = `${quantity}x ₱${unitPrice.toFixed(2)} = ₱${subtotal.toFixed(2)}`;
  const priceWidth = qtyPriceStr.length;
  const maxNameWidthOnPriceLine = maxWidth - priceWidth - 1; // 1 space separator
  
  // If product name fits on one line with price
  if (productName.length <= maxNameWidthOnPriceLine) {
    const padding = maxNameWidthOnPriceLine - productName.length;
    const line = productName + " ".repeat(padding) + " " + qtyPriceStr;
    return [truncateLine(line, maxWidth)];
  }
  
  // Product name needs 2 lines
  // Try to break at a space, targeting ~50% of first line
  const firstLineTargetLen = Math.floor(maxWidth / 2);
  let breakPoint = productName.lastIndexOf(" ", firstLineTargetLen);
  
  // If no space found, just break at the target length
  if (breakPoint === -1) {
    breakPoint = firstLineTargetLen;
  }
  
  const firstLine = productName.substring(0, breakPoint).trim();
  let secondLineName = productName.substring(breakPoint).trim();
  
  // Truncate second line name if it's too long for the available space
  const maxSecondLineNameLen = maxNameWidthOnPriceLine - 3; // Space for "..."
  if (secondLineName.length > maxSecondLineNameLen) {
    secondLineName = secondLineName.substring(0, maxSecondLineNameLen) + "...";
  }
  
  const padding = maxNameWidthOnPriceLine - secondLineName.length;
  const secondLine = secondLineName + " ".repeat(padding) + " " + qtyPriceStr;
  
  return [
    truncateLine(firstLine, maxWidth),
    truncateLine(secondLine, maxWidth)
  ];
}

/**
 * Helper: Center text within max width
 */
function centerLine(text: string, maxWidth: number = 40): string {
  if (text.length >= maxWidth) {
    return text.substring(0, maxWidth);
  }
  const leftPad = Math.floor((maxWidth - text.length) / 2);
  const rightPad = maxWidth - text.length - leftPad;
  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

/**
 * Helper: Create a separator line of exact width
 */
function separatorLine(char: string = "=", maxWidth: number = 40): string {
  return char.repeat(maxWidth);
}

/**
 * Helper: Format a line with label left-aligned and amount right-aligned
 * Optimized for 40-char width (thermal printer standard)
 */
function formatReceiptLine(
  label: string,
  amount?: number | string,
  maxWidth: number = 40
): string {
  if (!amount && amount !== 0) {
    return truncateLine(label, maxWidth);
  }

  const amountStr =
    typeof amount === "number" ? `₱${amount.toFixed(2)}` : amount.toString();
  const amountWidth = amountStr.length;
  const availableForLabel = maxWidth - amountWidth;
  
  // Truncate label if needed
  const truncatedLabel = label.length > availableForLabel 
    ? label.substring(0, Math.max(1, availableForLabel - 1))
    : label;
  
  const padding = Math.max(1, availableForLabel - truncatedLabel.length);
  const line = truncatedLabel + " ".repeat(padding) + amountStr;
  
  return truncateLine(line, maxWidth);
}

/**
 * Formats a receipt object as plaintext for thermal printer
 * @param receipt - The receipt data to format
 * @returns Formatted plaintext receipt string
 */
export function formatReceiptAsPlaintext(receipt: CompactReceipt): string {
  const lines: string[] = [];

  // Extract short order ID (before first hyphen)
  const shortOrderId = receipt.orderId.split("-")[0].toUpperCase();

  // Header
  lines.push(separatorLine("=", 40));
  lines.push(centerLine("KATFLIX LAUNDRY", 40));
  lines.push(centerLine("ORDER RECEIPT", 40));
  lines.push(separatorLine("=", 40));
  lines.push("");

  // Order Info
  lines.push(formatReceiptLine("Order ID:", shortOrderId, 40));
  lines.push(formatReceiptLine("Customer:", receipt.customerName, 40));
  lines.push(
    formatReceiptLine(
      "Date/Time:",
      new Date(receipt.timestamp).toLocaleString(),
      40
    )
  );
  lines.push("");

  // Baskets Section
  if (receipt.baskets && receipt.baskets.length > 0) {
    lines.push(separatorLine("-", 40));
    lines.push(centerLine("LAUNDRY SERVICES", 40));
    lines.push(separatorLine("-", 40));

    for (const basket of receipt.baskets) {
      lines.push(truncateLine(`Basket ${basket.basket_number} (${basket.weight_kg}kg)`, 40));

      if (basket.services) {
        const { services } = basket;

        if (services.wash && services.wash !== "off") {
          const price = services.wash_pricing?.base_price || 0;
          const name = services.wash_pricing?.name || services.wash;
          lines.push(formatReceiptLine(`  Wash (${name})`, price, 40));
        }

        if (services.spin) {
          const price = services.spin_pricing?.base_price || 0;
          lines.push(formatReceiptLine("  Spin", price, 40));
        }

        if (services.dry && services.dry !== "off") {
          const price = services.dry_pricing?.base_price || 0;
          const name = services.dry_pricing?.name || services.dry;
          lines.push(formatReceiptLine(`  Dry (${name})`, price, 40));
        }

        if (services.additional_dry_time_minutes && services.additional_dry_time_minutes > 0) {
          const minutes = services.additional_dry_time_minutes;
          const price = services.additional_dry_time_pricing?.base_price || 0;
          lines.push(formatReceiptLine(`  Extra Dry (${minutes}m)`, price, 40));
        }

        if (services.iron_weight_kg && services.iron_weight_kg > 0) {
          const kg = services.iron_weight_kg;
          const price = services.iron_pricing?.base_price || 0;
          const totalPrice = price * kg;
          lines.push(formatReceiptLine(`  Iron (${kg}kg)`, totalPrice, 40));
        }

        if (services.plastic_bags && services.plastic_bags > 0) {
          lines.push(truncateLine(`  Bags (${services.plastic_bags}pc)`, 40));
        }

        if (services.staff_service_pricing && services.staff_service_pricing.base_price > 0) {
          const price = services.staff_service_pricing.base_price;
          const name = services.staff_service_pricing.name || "Staff Service";
          lines.push(formatReceiptLine(`  ${name}`, price, 40));
        }
      }

      lines.push(formatReceiptLine("  Subtotal:", basket.subtotal, 40));
      lines.push("");
    }
  }

  // Products Section
  if (receipt.items && receipt.items.length > 0) {
    lines.push(separatorLine("-", 40));
    lines.push(centerLine("PRODUCTS", 40));
    lines.push(separatorLine("-", 40));

    for (const item of receipt.items) {
      const productLines = formatProductLine(
        item.product_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        40
      );
      lines.push(...productLines);
    }
    lines.push("");
  }

  // Summary Section
  if (receipt.summary) {
    const sum = receipt.summary;
    lines.push(separatorLine("-", 40));
    lines.push(centerLine("SUMMARY", 40));
    lines.push(separatorLine("-", 40));

    if (sum.subtotal_products && sum.subtotal_products > 0) {
      lines.push(formatReceiptLine("Products:", sum.subtotal_products, 40));
    }
    if (sum.subtotal_services && sum.subtotal_services > 0) {
      lines.push(formatReceiptLine("Services:", sum.subtotal_services, 40));
    }
    if (sum.staff_service_fee && sum.staff_service_fee > 0) {
      lines.push(formatReceiptLine("Staff Fee:", sum.staff_service_fee, 40));
    }
    if (sum.delivery_fee && sum.delivery_fee > 0) {
      lines.push(formatReceiptLine("Delivery:", sum.delivery_fee, 40));
    }
    if (sum.vat_amount && sum.vat_amount > 0) {
      lines.push(formatReceiptLine("VAT (12%):", sum.vat_amount, 40));
    }
    if (sum.loyalty_discount && sum.loyalty_discount > 0) {
      lines.push(formatReceiptLine("Loyalty Discount:", -sum.loyalty_discount, 40));
    }
  }

  lines.push("");
  lines.push(separatorLine("=", 40));
  lines.push(formatReceiptLine("TOTAL:", receipt.total, 40));
  lines.push(separatorLine("=", 40));

  // Payment Section
  if (receipt.paymentMethod) {
    lines.push("");
    lines.push(formatReceiptLine("Payment:", receipt.paymentMethod, 40));

    if (receipt.change !== undefined && receipt.change > 0) {
      lines.push(formatReceiptLine("Change:", receipt.change, 40));
    }
  }

  // Footer
  lines.push("");
  lines.push(separatorLine("=", 40));
  lines.push(centerLine("Thank you for your order!", 40));
  lines.push(centerLine("Visit us again!", 40));
  lines.push(separatorLine("=", 40));
  lines.push("");

  return lines.join("\n");
}
