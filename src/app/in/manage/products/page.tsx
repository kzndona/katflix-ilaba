"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  getInventoryHistory,
  getTransactionSummary,
} from "@/src/app/in/pos/logic/inventoryUtils";

type Product = {
  id: string;
  item_name: string;
  sku: string | null;
  unit_price: string | null;
  unit_cost: string | null;
  quantity: string;
  reorder_level: string;
  is_active: boolean;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
};

type SortConfig = {
  key: keyof Product;
  direction: "asc" | "desc";
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [filteredRows, setFilteredRows] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "item_name",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedProductForView, setSelectedProductForView] = useState<Product | null>(null);
  const [adjustmentTransactions, setAdjustmentTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const ROWS_PER_PAGE = 10;

  useEffect(() => {
    load();
  }, []);

  // Load transactions for selected product
  useEffect(() => {
    if (selectedProductForView) {
      viewProductDetails(selectedProductForView);
    }
  }, [selectedProductForView]);

  // Apply search and sort
  useEffect(() => {
    const timer = setTimeout(() => {
      let result = rows;

      // Search
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        result = result.filter((product) => {
          return (
            product.item_name.toLowerCase().includes(query) ||
            (product.sku?.toLowerCase().includes(query) ?? false) ||
            String(product.quantity).includes(query) ||
            String(product.unit_price).includes(query) ||
            (product.created_at?.toLowerCase().includes(query) ?? false) ||
            (product.updated_at?.toLowerCase().includes(query) ?? false) ||
            (product.updated_by?.toLowerCase().includes(query) ?? false)
          );
        });
      }

      // Sort
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(String(bVal));
          return sortConfig.direction === "asc" ? cmp : -cmp;
        } else if (typeof aVal === "number") {
          const numBVal = Number(bVal);
          return sortConfig.direction === "asc"
            ? aVal - numBVal
            : numBVal - aVal;
        }
        return 0;
      });

      setFilteredRows(result);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, rows, sortConfig]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/manage/products/getAllProducts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const normalized: Product[] = (data || []).map((r: any) => ({
        id: r.id,
        item_name: r.item_name ?? "",
        sku: r.sku ?? null,
        unit_price:
          r.unit_price !== null && r.unit_price !== undefined
            ? String(r.unit_price)
            : null,
        unit_cost:
          r.unit_cost !== null && r.unit_cost !== undefined
            ? String(r.unit_cost)
            : null,
        quantity:
          r.quantity !== null && r.quantity !== undefined
            ? String(Math.trunc(Number(r.quantity)))
            : "0",
        reorder_level:
          r.reorder_level !== null && r.reorder_level !== undefined
            ? String(Math.trunc(Number(r.reorder_level)))
            : "0",
        is_active: r.is_active ?? true,
        image_url: r.image_url ?? null,
        created_at: r.created_at ?? undefined,
        updated_at: r.updated_at ?? undefined,
        updated_by: r.updated_by ?? undefined,
      }));
      setRows(normalized);
      setFilteredRows(normalized);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function viewProductDetails(product: Product) {
    setLoadingTransactions(true);
    try {
      const result = await getInventoryHistory(product.id);
      setAdjustmentTransactions(result.transactions || []);
    } catch (err) {
      console.error(err);
      setAdjustmentTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  function openNew() {
    setEditing({
      id: "",
      item_name: "",
      sku: null,
      unit_price: "",
      unit_cost: "",
      quantity: "0",
      reorder_level: "0",
      is_active: true,
      image_url: null,
    });
    setErrorMsg(null);
  }

  function openEdit(row: Product) {
    setEditing(row);
    setErrorMsg(null);
  }

  function updateField<K extends keyof Product>(key: K, value: Product[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function validateForm(data: Product) {
    if (!data.item_name.trim()) return "item_name is required";
    return null;
  }

  async function save() {
    if (!editing) return;
    setErrorMsg(null);

    const validation = validateForm(editing);
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        item_name: editing.item_name.trim(),
        sku: editing.sku?.trim() || null,
        unit_price:
          editing.unit_price === "" ? null : Number(editing.unit_price),
        unit_cost: editing.unit_cost === "" ? null : Number(editing.unit_cost),
        quantity: Number(Math.trunc(Number(editing.quantity))),
        reorder_level: Number(Math.trunc(Number(editing.reorder_level))),
        is_active: editing.is_active,
        image_url: editing.image_url || null,
      };

      const res = await fetch("/api/manage/products/saveProduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      await load();
      setEditing(null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    if (!confirm("Are you sure you want to delete this product?")) return;

    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/manage/products/removeProduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      await load();
      setEditing(null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to remove product");
    } finally {
      setSaving(false);
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  const handleSort = (key: keyof Product) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: keyof Product }) => {
    if (sortConfig.key !== field)
      return <span className="text-gray-300">⇅</span>;
    return <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

  // Calculate dashboard metrics
  const totalProducts = rows.length;
  const totalStock = rows.reduce((sum, p) => sum + parseInt(p.quantity), 0);
  const lowStockItems = rows.filter((p) => parseInt(p.quantity) <= parseInt(p.reorder_level)).length;
  const visibleCount = filteredRows.length;

  // Calculate transaction summary
  const transactionSummary =
    selectedProductForView && adjustmentTransactions.length > 0
      ? getTransactionSummary(adjustmentTransactions)
      : null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              📦 Products Management
            </h1>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            + Create New Product
          </button>
        </div>

        {/* Mini Dashboard Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-300 p-4">
            <div className="text-sm text-slate-600 font-semibold">Total Products</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{totalProducts}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-300 p-4">
            <div className="text-sm text-slate-600 font-semibold">Total Stock</div>
            <div className="text-3xl font-bold text-blue-600 mt-1">{totalStock}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-300 p-4">
            <div className="text-sm text-slate-600 font-semibold">Low Stock Items</div>
            <div className={`text-3xl font-bold mt-1 ${lowStockItems > 0 ? "text-red-600" : "text-green-600"}`}>
              {lowStockItems}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-300 p-4">
            <div className="text-sm text-slate-600 font-semibold">Visible Count</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{visibleCount}</div>
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-red-800 text-xs font-medium">{errorMsg}</div>
          </div>
        )}

        {/* 2-Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* LEFT: Products List */}
          <div className="space-y-4 bg-white rounded-lg border border-slate-300 p-6">
            <h2 className="text-xl font-bold text-slate-900">Products List</h2>

            {/* Search Bar */}
            <div>
              <input
                type="text"
                placeholder="Search by name, SKU, price..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Products List */}
            <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded p-2">
              {loading ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  Loading products...
                </div>
              ) : paginatedRows.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  {rows.length === 0
                    ? "No products yet. Create one to get started!"
                    : "No results match your search."}
                </div>
              ) : (
                paginatedRows.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductForView(product)}
                    className={`p-3 border border-slate-200 rounded cursor-pointer hover:bg-blue-50 transition ${
                      selectedProductForView?.id === product.id
                        ? "bg-blue-100 border-blue-400"
                        : ""
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">
                      {product.item_name}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      SKU: {product.sku || "—"}
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span>Stock: <span className="font-bold">{product.quantity}</span></span>
                      <span className={product.is_active ? "text-green-600" : "text-red-600"}>
                        {product.is_active ? "✓ Active" : "✗ Inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex gap-2 justify-between items-center border-t border-slate-200 pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-xs text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Product Details & Transaction History */}
          <div className="space-y-4 bg-white rounded-lg border border-slate-300 p-6">
            <h2 className="text-xl font-bold text-slate-900">
              Product Details & History
            </h2>

            {selectedProductForView ? (
              <>
                {/* Product Details Card */}
                <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
                  <div>
                    <div className="text-xs text-slate-600 font-semibold">Product Name</div>
                    <div className="text-sm font-bold text-slate-900">
                      {selectedProductForView.item_name}
                    </div>
                  </div>

                  {selectedProductForView.sku && (
                    <div>
                      <div className="text-xs text-slate-600 font-semibold">SKU</div>
                      <div className="text-sm text-slate-900">
                        {selectedProductForView.sku}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-600 font-semibold">Unit Cost</div>
                      <div className="text-sm font-bold text-blue-700">
                        {selectedProductForView.unit_cost
                          ? `₱${parseFloat(selectedProductForView.unit_cost).toFixed(2)}`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 font-semibold">Unit Price</div>
                      <div className="text-sm font-bold text-green-700">
                        {selectedProductForView.unit_price
                          ? `₱${parseFloat(selectedProductForView.unit_price).toFixed(2)}`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <div className="text-xs text-blue-600 font-semibold">
                        Current Stock
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {selectedProductForView.quantity}
                      </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-300 rounded p-3">
                      <div className="text-xs text-purple-600 font-semibold">
                        Reorder Level
                      </div>
                      <div className="text-2xl font-bold text-purple-900">
                        {selectedProductForView.reorder_level}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(selectedProductForView)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                    >
                      Edit Product
                    </button>
                  </div>
                </div>

                {/* Transaction Summary */}
                {transactionSummary && (
                  <div className="bg-slate-100 rounded p-4 space-y-2">
                    <div className="text-sm font-bold text-slate-600">
                      Transaction Summary
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-600">Deducted</div>
                        <div className="font-bold text-slate-900">
                          -{transactionSummary.total_deducted}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Returned</div>
                        <div className="font-bold text-slate-900">
                          +{transactionSummary.total_returned}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Net Change</div>
                        <div
                          className={`font-bold ${transactionSummary.net_change >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {transactionSummary.net_change > 0 ? "+" : ""}
                          {transactionSummary.net_change}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Transactions</div>
                        <div className="font-bold text-slate-900">
                          {transactionSummary.transaction_count}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction History */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-900">
                    Transaction History
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded p-2">
                    {loadingTransactions ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Loading transactions...
                      </div>
                    ) : adjustmentTransactions.length > 0 ? (
                      adjustmentTransactions.map((tx, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-300 rounded p-2 hover:bg-slate-50"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-bold text-slate-900 text-xs">
                                {tx.transaction_type?.toUpperCase() || "TRANSACTION"}
                              </div>
                              <div
                                className={`text-xs font-bold ${
                                  tx.quantity_change > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {tx.quantity_change > 0 ? "+" : ""}
                                {tx.quantity_change}
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
                            <div className="text-xs text-slate-600 mt-1">
                              📝 {tx.notes}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-600 text-xs">
                        No transactions yet
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-80 text-slate-600 text-sm">
                Select a product to view details and history
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal - Slide from Right */}
      {editing && (
        <EditModal
          product={editing}
          updateField={updateField}
          save={save}
          remove={remove}
          saving={saving}
          errorMsg={errorMsg}
          onClose={() => {
            setEditing(null);
            setErrorMsg(null);
          }}
          isNewProduct={!editing.id}
        />
      )}
    </div>
  );
}

// Edit Modal Component
function EditModal({
  product,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  onClose,
  isNewProduct,
}: {
  product: Product;
  updateField: (key: keyof Product, value: any) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  saving: boolean;
  errorMsg: string | null;
  onClose: () => void;
  isNewProduct: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
      {/* Modal Slide from Right */}
      <div
        className="bg-white shadow-2xl h-full w-full max-w-md flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-3 border-b border-gray-200 bg-linear-to-r from-blue-50 to-blue-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isNewProduct ? "Add New Product" : "Edit Product"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-xl font-light transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-red-800 text-xs font-medium">
                  {errorMsg}
                </div>
              </div>
            )}

            {/* Item Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={product.item_name}
                onChange={(e) => updateField("item_name", e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Product Name"
              />
            </div>

            {/* SKU */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                SKU (Stock Keeping Unit)
              </label>
              <input
                type="text"
                value={product.sku ?? ""}
                onChange={(e) => updateField("sku", e.target.value || null)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., PROD-001"
              />
            </div>

            {/* Unit Cost and Unit Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Unit Cost (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={product.unit_cost ?? ""}
                  onChange={(e) =>
                    updateField(
                      "unit_cost",
                      e.target.value === "" ? "" : e.target.value,
                    )
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Unit Price (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={product.unit_price ?? ""}
                  onChange={(e) =>
                    updateField(
                      "unit_price",
                      e.target.value === "" ? "" : e.target.value,
                    )
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Quantity and Reorder Level */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="1"
                  value={product.quantity}
                  onChange={(e) =>
                    updateField(
                      "quantity",
                      e.target.value === "" ? "0" : e.target.value,
                    )
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Reorder Level
                </label>
                <input
                  type="number"
                  step="1"
                  value={product.reorder_level}
                  onChange={(e) =>
                    updateField(
                      "reorder_level",
                      e.target.value === "" ? "0" : e.target.value,
                    )
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Image Upload */}
            <ImageUploadField
              product={product}
              updateField={updateField}
              saving={saving}
            />

            {/* Active Checkbox */}
            <div className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id="is_active"
                checked={product.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="is_active"
                className="text-xs font-semibold text-gray-900 cursor-pointer"
              >
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded text-gray-900 text-xs font-medium hover:bg-gray-100 transition"
            disabled={saving}
          >
            Cancel
          </button>
          {!isNewProduct && (
            <button
              onClick={remove}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition"
              disabled={saving}
            >
              Delete
            </button>
          )}
          <button
            onClick={save}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving..." : isNewProduct ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Image Upload Component
function ImageUploadField({
  product,
  updateField,
  saving,
}: {
  product: Product;
  updateField: (key: keyof Product, value: any) => void;
  saving: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  );

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be under 5MB");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const timestamp = Date.now();
      const filename = `${product.id}-${timestamp}`;

      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(filename, file, { upsert: true });

      if (error) throw error;

      const imageUrl = `https://nkcfolnwxxnsskaerkyq.supabase.co/storage/v1/object/public/product-images/${data.path}`;
      updateField("image_url", imageUrl);
      setUploadError(null);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!product.image_url) return;

    setUploadError(null);
    setUploading(true);

    try {
      const filename = product.image_url.split("/").pop();
      if (!filename) throw new Error("Invalid image URL");

      const { error } = await supabase.storage
        .from("product-images")
        .remove([filename]);

      if (error) throw error;

      updateField("image_url", null);
      setUploadError(null);
    } catch (err) {
      console.error("Delete error:", err);
      setUploadError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-900">
        Product Image
      </label>

      {product.image_url && (
        <div className="relative w-full">
          <img
            src={product.image_url}
            alt={product.item_name}
            className="w-full h-32 object-cover rounded-lg border border-gray-300"
          />
          <button
            onClick={handleDelete}
            disabled={uploading || saving}
            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {!product.image_url && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            disabled={uploading || saving}
            className="hidden"
          />
          <label htmlFor="image-upload" className="cursor-pointer block">
            <div className="text-2xl mb-2">🖼️</div>
            <div className="text-xs font-medium text-gray-700">
              Drag image here or click to upload
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Max 5MB • JPG, PNG, etc.
            </div>
          </label>
        </div>
      )}

      {uploadError && (
        <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">
          {uploadError}
        </div>
      )}

      {uploading && (
        <div className="text-blue-600 text-xs bg-blue-50 border border-blue-200 rounded-lg p-2">
          Uploading...
        </div>
      )}
    </div>
  );
}
