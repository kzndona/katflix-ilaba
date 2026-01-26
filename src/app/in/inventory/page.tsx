"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/src/app/utils/supabase/client";
import {
  recordInventoryTransaction,
  getInventoryHistory,
  getTransactionSummary,
  TRANSACTION_TYPES,
} from "@/src/app/in/pos/logic/inventoryUtils";

/**
 * Inventory Management Page
 * - Adjust stock levels
 * - View transaction history
 * - Reconcile inventory
 */

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<any>("adjustment");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const supabase = createClient();

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("item_name");

      if (data) setProducts(data);
    };

    loadProducts();
  }, []);

  // Load transactions for selected product
  useEffect(() => {
    if (selectedProduct) {
      loadTransactions();
    }
  }, [selectedProduct]);

  const loadTransactions = async () => {
    try {
      const result = await getInventoryHistory(selectedProduct.id);
      setTransactions(result.transactions || []);
      setError("");
    } catch (err) {
      setError("Failed to load transaction history");
    }
  };

  const handleAdjustment = async () => {
    if (!selectedProduct || adjustmentQty === 0) {
      setError("Select product and enter quantity");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await recordInventoryTransaction(
        selectedProduct.id,
        adjustmentQty,
        {
          transaction_type: adjustmentType,
          notes: adjustmentNotes || undefined,
        }
      );

      setSuccess(
        `Stock adjusted: ${selectedProduct.item_name} (${adjustmentQty > 0 ? "+" : ""}${adjustmentQty}) - New stock: ${result.new_quantity}`
      );

      // Reset form
      setAdjustmentQty(0);
      setAdjustmentNotes("");

      // Reload transactions and products
      await loadTransactions();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("item_name");
      if (data) setProducts(data);

      // Update selected product
      const updated = data?.find((p) => p.id === selectedProduct.id);
      if (updated) setSelectedProduct(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setLoading(false);
    }
  };

  const summary = selectedProduct && transactions.length > 0 
    ? getTransactionSummary(transactions)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">📦 Inventory Management</h1>

        <div className="grid grid-cols-2 gap-6">
          {/* LEFT: Product Selection & Adjustment */}
          <div className="space-y-6 bg-white rounded-lg border border-slate-300 p-6">
            <h2 className="text-xl font-bold text-slate-900">Adjust Stock</h2>

            {/* Product Selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Product</label>
              <select
                value={selectedProduct?.id || ""}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  setSelectedProduct(product || null);
                }}
                className="w-full border border-slate-300 rounded px-3 py-2"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.item_name} (Stock: {p.quantity})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <>
                {/* Current Stock Display */}
                <div className="bg-blue-50 border border-blue-300 rounded p-4">
                  <div className="text-sm text-blue-600 font-semibold">Current Stock</div>
                  <div className="text-3xl font-bold text-blue-900">
                    {selectedProduct.quantity}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">units</div>
                </div>

                {/* Transaction Type */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Transaction Type
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2"
                  >
                    <option value={TRANSACTION_TYPES.ADJUSTMENT}>Adjustment</option>
                    <option value={TRANSACTION_TYPES.RESTOCK}>Restock</option>
                    <option value={TRANSACTION_TYPES.DAMAGE}>Damage Loss</option>
                    <option value={TRANSACTION_TYPES.RETURN}>Return</option>
                  </select>
                </div>

                {/* Quantity Adjustment */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quantity Change</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdjustmentQty(adjustmentQty - 1)}
                      className="px-4 py-2 bg-red-500 text-white rounded font-bold hover:bg-red-600"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-center font-bold text-lg"
                    />
                    <button
                      onClick={() => setAdjustmentQty(adjustmentQty + 1)}
                      className="px-4 py-2 bg-green-500 text-white rounded font-bold hover:bg-green-600"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Notes</label>
                  <input
                    type="text"
                    placeholder="e.g., Received from supplier, stock count discrepancy"
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="bg-red-100 border border-red-400 rounded p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-100 border border-green-400 rounded p-3 text-green-700 text-sm">
                    ✅ {success}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleAdjustment}
                  disabled={loading || adjustmentQty === 0}
                  className="w-full bg-slate-900 text-white py-3 rounded font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Record Transaction"}
                </button>
              </>
            )}
          </div>

          {/* RIGHT: Transaction History */}
          <div className="space-y-6 bg-white rounded-lg border border-slate-300 p-6">
            <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>

            {selectedProduct ? (
              <>
                {/* Summary */}
                {summary && (
                  <div className="bg-slate-100 rounded p-4 space-y-2">
                    <div className="text-sm font-bold text-slate-600">Summary</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-600">Deducted</div>
                        <div className="font-bold text-slate-900">
                          -{summary.total_deducted}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Returned</div>
                        <div className="font-bold text-slate-900">
                          +{summary.total_returned}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Net Change</div>
                        <div className={`font-bold ${summary.net_change >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {summary.net_change > 0 ? "+" : ""}{summary.net_change}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Transactions</div>
                        <div className="font-bold text-slate-900">
                          {summary.transaction_count}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transactions List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transactions.length > 0 ? (
                    transactions.map((tx, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-300 rounded p-3 hover:bg-slate-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-bold text-slate-900">
                              {tx.transaction_type.toUpperCase()}
                            </div>
                            <div className={`text-sm font-bold ${
                              tx.quantity_change > 0 ? "text-green-600" : "text-red-600"
                            }`}>
                              {tx.quantity_change > 0 ? "+" : ""}{tx.quantity_change}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-600">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(tx.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        {tx.notes && (
                          <div className="text-xs text-slate-600 mt-2">
                            📝 {tx.notes}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-600">
                      No transactions yet
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-600">
                Select a product to view history
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
