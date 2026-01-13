/**
 * Receipt Generator - Creates compact thermal receipt format
 * Designed for 80mm thermal printers, works with any printer via PDF
 */

export interface CompactReceipt {
  orderNumber: string;
  timestamp: string;
  customerName: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  serviceFee: number;
  handlingFee: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  change?: number;
  pickup: {
    scheduled: boolean;
    address?: string;
  };
  delivery: {
    scheduled: boolean;
    address?: string;
    fee: number;
  };
  estimatedReadyTime?: string;
  notes?: string;
}

export interface ReceiptItem {
  type: "product" | "service";
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
  details?: string; // e.g., "Basket 1 • 2.5kg" or "Premium Wash"
}

export function generateCompactReceipt(
  orderId: string,
  timestamp: Date,
  customer: any,
  productLines: any[],
  basketLines: any[],
  handling: any,
  paymentData: any,
  totals: any
): CompactReceipt {
  const items: ReceiptItem[] = [];

  // Add products
  productLines.forEach((line: any) => {
    items.push({
      type: "product",
      name: line.name,
      quantity: line.qty,
      price: line.price,
      lineTotal: line.lineTotal,
    });
  });

  // Add basket services (compact format)
  basketLines.forEach((basket: any) => {
    const services = [];
    if (basket.breakdown.wash > 0) {
      services.push(`${basket.premiumFlags.wash ? "Premium " : ""}Wash`);
    }
    if (basket.breakdown.dry > 0) {
      services.push(`${basket.premiumFlags.dry ? "Premium " : ""}Dry`);
    }
    if (basket.breakdown.spin > 0) services.push("Spin");
    if (basket.breakdown.iron > 0) services.push("Iron");
    if (basket.breakdown.fold > 0) services.push("Fold");

    if (services.length > 0) {
      items.push({
        type: "service",
        name: services.join(" + "),
        quantity: 1,
        price: basket.total,
        lineTotal: basket.total,
        details: `${basket.name} • ${basket.weightKg}kg • ${basket.estimatedDurationMinutes}min`,
      });
    }
  });

  const amountPaid = paymentData.amountPaid || totals.total;
  const change = paymentData.method === "cash" ? amountPaid - totals.total : 0;

  return {
    orderNumber: orderId.substring(0, 8).toUpperCase(),
    timestamp: timestamp.toLocaleString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
    customerName: customer?.first_name
      ? `${customer.first_name} ${customer.last_name || ""}`
      : "Walk-in",
    customerPhone: customer?.phone_number,
    items,
    subtotal: totals.productSubtotal + totals.basketSubtotal,
    serviceFee: totals.serviceFee,
    handlingFee: totals.handlingFee,
    taxAmount: totals.taxIncluded,
    total: totals.total,
    paymentMethod: paymentData.method === "cash" ? "CASH" : "GCASH",
    amountPaid: paymentData.method === "cash" ? amountPaid : undefined,
    change: paymentData.method === "cash" ? change : undefined,
    pickup: {
      scheduled: handling.pickup.status === "pending" || handling.pickup.status === "scheduled",
      address: handling.pickup.address,
    },
    delivery: {
      scheduled: handling.delivery.status === "pending" || handling.delivery.status === "scheduled",
      address: handling.delivery.address,
      fee: handling.delivery.fee || 0,
    },
    estimatedReadyTime: undefined, // Can be added if calculated
    notes: handling.instructions,
  };
}

/**
 * Format receipt as plaintext (80mm thermal printer format)
 * Returns formatted string ready for printing
 */
export function formatReceiptAsPlaintext(receipt: CompactReceipt): string {
  const lines: string[] = [];
  const width = 40; // 80mm / 2mm per char ≈ 40 chars

  const center = (text: string) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  };

  const padRight = (label: string, value: string) => {
    const gap = width - label.length - value.length;
    return label + " ".repeat(Math.max(1, gap)) + value;
  };

  // Header
  lines.push(center("=".repeat(width - 2)));
  lines.push(center("KATFLIX"));
  lines.push(center("Laundry Services"));
  lines.push(center("=".repeat(width - 2)));
  lines.push("");

  // Order info
  lines.push(`ORDER: ${receipt.orderNumber}`);
  lines.push(receipt.timestamp);
  lines.push(`Customer: ${receipt.customerName}`);
  if (receipt.customerPhone) {
    lines.push(`Phone: ${receipt.customerPhone}`);
  }
  lines.push("-".repeat(width));
  lines.push("");

  // Items
  receipt.items.forEach((item) => {
    const qty = item.quantity;
    const itemTotal = item.lineTotal.toFixed(2);

    lines.push(`${item.name} x${qty}`);
    if (item.details) {
      lines.push(`  ${item.details}`);
    }
    lines.push(padRight(`  Price:`, `₱${itemTotal}`));
    lines.push("");
  });

  lines.push("-".repeat(width));
  lines.push("");

  // Totals
  lines.push(
    padRight(`Subtotal:`, `₱${receipt.subtotal.toFixed(2)}`)
  );

  if (receipt.serviceFee > 0) {
    lines.push(
      padRight(`Service Fee:`, `₱${receipt.serviceFee.toFixed(2)}`)
    );
  }

  if (receipt.handlingFee > 0) {
    lines.push(
      padRight(`Handling Fee:`, `₱${receipt.handlingFee.toFixed(2)}`)
    );
  }

  lines.push(
    padRight(`Tax (VAT):`, `₱${receipt.taxAmount.toFixed(2)}`)
  );

  lines.push("=".repeat(width));
  lines.push(
    padRight(`TOTAL:`, `₱${receipt.total.toFixed(2)}`)
  );
  lines.push("=".repeat(width));
  lines.push("");

  // Payment
  lines.push(
    padRight(`Payment:`, receipt.paymentMethod)
  );

  if (receipt.amountPaid !== undefined) {
    lines.push(
      padRight(`Amount Paid:`, `₱${receipt.amountPaid.toFixed(2)}`)
    );
  }

  if (receipt.change !== undefined && receipt.change > 0) {
    lines.push(
      padRight(`Change:`, `₱${receipt.change.toFixed(2)}`)
    );
  }

  lines.push("");
  lines.push("-".repeat(width));
  lines.push("");

  // Handling info
  if (receipt.pickup.scheduled || receipt.delivery.scheduled) {
    if (receipt.pickup.scheduled) {
      lines.push("PICKUP SERVICE");
      if (receipt.pickup.address) {
        lines.push(`Location: ${receipt.pickup.address}`);
      }
      lines.push("");
    }

    if (receipt.delivery.scheduled) {
      lines.push("DELIVERY SERVICE");
      if (receipt.delivery.address) {
        lines.push(`Address: ${receipt.delivery.address}`);
      }
      lines.push(`Fee: ₱${receipt.delivery.fee.toFixed(2)}`);
      lines.push("");
    }
  }

  if (receipt.notes) {
    lines.push(`Notes: ${receipt.notes}`);
    lines.push("");
  }

  lines.push("=".repeat(width));
  lines.push(center("Thank you!"));
  lines.push(center("Come again!"));
  lines.push("");

  return lines.join("\n");
}

/**
 * Format receipt for ESC/POS thermal printer (for future integration)
 * Returns string of ESC/POS commands
 */
export function generateESCPOSCommands(receipt: CompactReceipt): string {
  let commands = "";

  // Initialize
  commands += "\x1B\x40"; // Reset

  // Center alignment
  commands += "\x1B\x61\x01";

  // Logo/Header
  commands += "\n=== KATFLIX ===\n";
  commands += "Laundry Services\n";

  // Normal alignment
  commands += "\x1B\x61\x00";

  commands += "\n" + "-".repeat(40) + "\n";
  commands += `Order: ${receipt.orderNumber}\n`;
  commands += `Time: ${receipt.timestamp}\n`;
  commands += `Customer: ${receipt.customerName}\n`;
  if (receipt.customerPhone) {
    commands += `Phone: ${receipt.customerPhone}\n`;
  }
  commands += "-".repeat(40) + "\n\n";

  // Items
  receipt.items.forEach((item) => {
    const qty = item.quantity;
    const price = item.price.toFixed(2);
    const total = item.lineTotal.toFixed(2);

    commands += `${item.name} x${qty}\n`;
    if (item.details) {
      commands += `  ${item.details}\n`;
    }
    // Right-align price
    const priceLine = `₱${price}`.padStart(20);
    const totalLine = `₱${total}`.padStart(20);
    commands += priceLine + "\n";
    commands += totalLine + "\n";
  });

  commands += "\n" + "-".repeat(40) + "\n";

  // Totals
  commands += `Subtotal:        ₱${receipt.subtotal.toFixed(2).padStart(10)}\n`;
  if (receipt.serviceFee > 0) {
    commands += `Service Fee:     ₱${receipt.serviceFee.toFixed(2).padStart(10)}\n`;
  }
  if (receipt.handlingFee > 0) {
    commands += `Handling Fee:    ₱${receipt.handlingFee.toFixed(2).padStart(10)}\n`;
  }
  commands += `Tax (VAT):       ₱${receipt.taxAmount.toFixed(2).padStart(10)}\n`;
  commands += "=" + "=".repeat(39) + "\n";
  commands += `TOTAL:           ₱${receipt.total.toFixed(2).padStart(10)}\n`;

  // Payment
  commands += "-".repeat(40) + "\n";
  commands += `Payment: ${receipt.paymentMethod}\n`;
  if (receipt.amountPaid !== undefined) {
    commands += `Amount Paid:     ₱${receipt.amountPaid.toFixed(2).padStart(10)}\n`;
    if (receipt.change !== undefined && receipt.change > 0) {
      commands += `Change:          ₱${receipt.change.toFixed(2).padStart(10)}\n`;
    }
  }

  // Handling info
  commands += "\n" + "-".repeat(40) + "\n";
  if (receipt.pickup.scheduled) {
    commands += "PICKUP SERVICE\n";
    if (receipt.pickup.address) {
      commands += `Location: ${receipt.pickup.address}\n`;
    }
  }
  if (receipt.delivery.scheduled) {
    commands += "DELIVERY SERVICE\n";
    if (receipt.delivery.address) {
      commands += `Address: ${receipt.delivery.address}\n`;
    }
    commands += `Fee: ₱${receipt.delivery.fee.toFixed(2)}\n`;
  }

  if (receipt.notes) {
    commands += `\nNotes: ${receipt.notes}\n`;
  }

  commands += "\n" + "=".repeat(40) + "\n";

  // Center alignment
  commands += "\x1B\x61\x01";
  commands += "Thank you!\n";
  commands += "Come again!\n";
  commands += "\x0A\x0A\x0A\x0A"; // Feed paper

  // Cut
  commands += "\x1D\x56\x00"; // Partial cut

  return commands;
}
