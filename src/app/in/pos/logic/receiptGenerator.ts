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
 * Helper: Format a line with label left-aligned and amount right-aligned
 * Optimized for 40-char width (thermal printer standard)
 */
function formatReceiptLine(
  label: string,
  amount?: number | string,
  maxWidth: number = 40
): string {
  if (!amount && amount !== 0) {
    return label.substring(0, maxWidth);
  }

  const amountStr =
    typeof amount === "number" ? `₱${amount.toFixed(2)}` : amount.toString();
  const padding = Math.max(1, maxWidth - label.length - amountStr.length);
  return label + " ".repeat(padding) + amountStr;
}

/**
 * Formats a receipt object as plaintext for thermal printer
 * @param receipt - The receipt data to format
 * @returns Formatted plaintext receipt string
 */
export function formatReceiptAsPlaintext(receipt: CompactReceipt): string {
  const lines: string[] = [];

  // Header
  lines.push("=====================================");
  lines.push("         KATFLIX LAUNDRY");
  lines.push("           ORDER RECEIPT");
  lines.push("=====================================");
  lines.push("");

  // Order Info
  lines.push(formatReceiptLine("Order ID:", receipt.orderId, 40));
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
    lines.push("-------------------------------------");
    lines.push("LAUNDRY SERVICES");
    lines.push("-------------------------------------");

    for (const basket of receipt.baskets) {
      lines.push(`Basket ${basket.basket_number} (${basket.weight_kg}kg)`);

      if (basket.services) {
        const { services } = basket;

        if (services.wash && services.wash !== "off") {
          const price = services.wash_pricing?.base_price || 0;
          const name = services.wash_pricing?.name || services.wash;
          lines.push(
            `  Wash (${name})        ₱${price.toFixed(2)}`
          );
        }

        if (services.spin) {
          const price = services.spin_pricing?.base_price || 0;
          lines.push(`  Spin                  ₱${price.toFixed(2)}`);
        }

        if (services.dry && services.dry !== "off") {
          const price = services.dry_pricing?.base_price || 0;
          const name = services.dry_pricing?.name || services.dry;
          lines.push(
            `  Dry (${name})         ₱${price.toFixed(2)}`
          );
        }

        if (services.additional_dry_time_minutes && services.additional_dry_time_minutes > 0) {
          const minutes = services.additional_dry_time_minutes;
          const price = services.additional_dry_time_pricing?.base_price || 0;
          lines.push(`  Extra Dry (${minutes}m)      ₱${price.toFixed(2)}`);
        }

        if (services.iron_weight_kg && services.iron_weight_kg > 0) {
          const kg = services.iron_weight_kg;
          const price = services.iron_pricing?.base_price || 0;
          const totalPrice = price * kg;
          lines.push(`  Iron (${kg}kg)        ₱${totalPrice.toFixed(2)}`);
        }

        if (services.plastic_bags && services.plastic_bags > 0) {
          lines.push(`  Bags (${services.plastic_bags}pc)`);
        }

        if (services.staff_service_pricing && services.staff_service_pricing.base_price > 0) {
          const price = services.staff_service_pricing.base_price;
          const name = services.staff_service_pricing.name || "Staff Service";
          lines.push(`  ${name}           ₱${price.toFixed(2)}`);
        }
      }

      lines.push(formatReceiptLine("  Subtotal:", basket.subtotal, 40));
      lines.push("");
    }
  }

  // Products Section
  if (receipt.items && receipt.items.length > 0) {
    lines.push("-------------------------------------");
    lines.push("PRODUCTS");
    lines.push("-------------------------------------");

    for (const item of receipt.items) {
      lines.push(`${item.product_name}`);
      lines.push(
        `  ${item.quantity}x ₱${item.unit_price.toFixed(2)} = ₱${item.subtotal.toFixed(2)}`
      );
    }
    lines.push("");
  }

  // Summary Section
  if (receipt.summary) {
    const sum = receipt.summary;
    lines.push("-------------------------------------");
    lines.push("SUMMARY");
    lines.push("-------------------------------------");

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
  lines.push("=====================================");
  lines.push(formatReceiptLine("TOTAL:", receipt.total, 40));
  lines.push("=====================================");

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
  lines.push("      Thank you for your order!      ");
  lines.push("           Visit us again!          ");
  lines.push("=====================================");
  lines.push("");

  return lines.join("\n");
}
