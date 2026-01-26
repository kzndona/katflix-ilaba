/**
 * Inventory utility functions for POS system
 */

export async function recordInventoryTransaction(
  productId: string,
  quantityChange: number,
  options?: {
    order_id?: string;
    transaction_type?: "order" | "adjustment" | "return" | "restock";
    notes?: string;
  }
) {
  try {
    const response = await fetch("/api/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        quantity_change: quantityChange,
        order_id: options?.order_id || null,
        transaction_type: options?.transaction_type || "adjustment",
        notes: options?.notes || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to record transaction");
    }

    return await response.json();
  } catch (error) {
    console.error("Record inventory transaction error:", error);
    throw error;
  }
}

export async function getInventoryHistory(
  productId: string,
  limit: number = 50
) {
  try {
    const response = await fetch(
      `/api/inventory/transactions?product_id=${productId}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch inventory history");
    }

    return await response.json();
  } catch (error) {
    console.error("Get inventory history error:", error);
    throw error;
  }
}

export async function validateInventoryAvailable(
  productId: string,
  requiredQuantity: number,
  currentStock: number
): Promise<{
  available: boolean;
  currentStock: number;
  requested: number;
  shortfall: number;
}> {
  const available = currentStock >= requiredQuantity;
  const shortfall = Math.max(0, requiredQuantity - currentStock);

  return {
    available,
    currentStock,
    requested: requiredQuantity,
    shortfall,
  };
}

/**
 * Common transaction types and their meanings
 */
export const TRANSACTION_TYPES = {
  ORDER: "order", // Stock deducted for order
  ADJUSTMENT: "adjustment", // Manual stock correction
  RETURN: "return", // Stock returned/refunded
  RESTOCK: "restock", // New stock received
  DAMAGE: "damage", // Stock damaged/lost
} as const;

/**
 * Calculate net stock change from transactions
 */
export function calculateNetStockChange(
  transactions: Array<{ quantity_change: number }>
): number {
  return transactions.reduce((sum, tx) => sum + tx.quantity_change, 0);
}

/**
 * Get transaction summary for a product
 */
export function getTransactionSummary(
  transactions: Array<{ 
    transaction_type: string; 
    quantity_change: number;
    created_at: string;
  }>
) {
  const summary = {
    total_deducted: 0,
    total_returned: 0,
    total_adjustments: 0,
    net_change: 0,
    transaction_count: transactions.length,
    date_range: {
      earliest: null as string | null,
      latest: null as string | null,
    },
  };

  transactions.forEach((tx) => {
    if (tx.transaction_type === "order" && tx.quantity_change < 0) {
      summary.total_deducted += Math.abs(tx.quantity_change);
    } else if (tx.transaction_type === "return" && tx.quantity_change > 0) {
      summary.total_returned += tx.quantity_change;
    } else if (tx.transaction_type === "adjustment") {
      summary.total_adjustments += tx.quantity_change;
    }

    summary.net_change += tx.quantity_change;
  });

  if (transactions.length > 0) {
    const dates = transactions.map((tx) => new Date(tx.created_at));
    summary.date_range.earliest = new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
    summary.date_range.latest = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
  }

  return summary;
}
