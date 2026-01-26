/**
 * Receipt Generator
 * Stub implementation for receipt generation and formatting
 * 
 * This file provides types and utilities for generating order receipts
 */

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CompactReceipt {
  orderId: string;
  customerName: string;
  items: ReceiptItem[];
  subtotal: number;
  total: number;
  timestamp: string;
  paymentMethod?: string;
  notes?: string;
}

/**
 * Formats a receipt object as plaintext
 * @param receipt - The receipt data to format
 * @returns Formatted plaintext receipt string
 */
export function formatReceiptAsPlaintext(receipt: CompactReceipt): string {
  const lines: string[] = [];
  
  lines.push("=====================================");
  lines.push("             ORDER RECEIPT           ");
  lines.push("=====================================");
  lines.push("");
  
  lines.push(`Order ID: ${receipt.orderId}`);
  lines.push(`Customer: ${receipt.customerName}`);
  lines.push(`Date/Time: ${receipt.timestamp}`);
  lines.push("");
  
  lines.push("-------------------------------------");
  lines.push("ITEMS");
  lines.push("-------------------------------------");
  
  for (const item of receipt.items) {
    lines.push(`${item.product_name}`);
    lines.push(`  ${item.quantity} × ₱${item.unit_price.toFixed(2)} = ₱${item.subtotal.toFixed(2)}`);
  }
  
  lines.push("");
  lines.push("-------------------------------------");
  lines.push(`Subtotal:      ₱${receipt.subtotal.toFixed(2)}`);
  lines.push(`TOTAL:         ₱${receipt.total.toFixed(2)}`);
  lines.push("-------------------------------------");
  
  if (receipt.paymentMethod) {
    lines.push(`Payment: ${receipt.paymentMethod}`);
  }
  
  if (receipt.notes) {
    lines.push("");
    lines.push(`Notes: ${receipt.notes}`);
  }
  
  lines.push("");
  lines.push("=====================================");
  lines.push("      Thank you for your order!      ");
  lines.push("=====================================");
  
  return lines.join("\n");
}
