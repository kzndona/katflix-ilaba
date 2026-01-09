// app/in/manage/products/page.tsx
"use client";

import { useEffect, useState } from "react";

type Products = {
  id: string;
  item_name: string;
  unit_price: string; // form value as string
  unit_cost: string; // form value as string
  quantity: string; // form value as string (whole number)
  reorder_level: string; // form value as string (whole number)
  is_active: boolean;
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Products[]>([]);
  const [filteredRows, setFilteredRows] = useState<Products[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Products | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editing, setEditing] = useState<Products | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quantity adjustment modal state
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantityAdjustment, setQuantityAdjustment] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">(
    "add"
  );

  useEffect(() => {
    load();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() === "") {
        setFilteredRows(rows);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = rows.filter((product) => {
          return product.item_name.toLowerCase().includes(query);
        });
        setFilteredRows(filtered);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, rows]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/manage/products/getProducts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      // Map numeric fields into strings for the form
      const normalized: Products[] = (data || []).map((r: any) => ({
        id: r.id,
        item_name: r.item_name ?? "",
        unit_price:
          r.unit_price !== undefined && r.unit_price !== null
            ? Number(r.unit_price).toFixed(2)
            : "0.00",
        unit_cost:
          r.unit_cost !== undefined && r.unit_cost !== null
            ? Number(r.unit_cost).toFixed(2)
            : "0.00",
        quantity:
          r.quantity !== undefined && r.quantity !== null
            ? String(Math.trunc(Number(r.quantity)))
            : "0",
        reorder_level:
          r.reorder_level !== undefined && r.reorder_level !== null
            ? String(Math.trunc(Number(r.reorder_level)))
            : "0",
        is_active: r.is_active ?? true,
      }));
      setRows(normalized);
      setFilteredRows(normalized);
    } catch (err) {
      console.error("Failed to load products:", err);
      setErrorMsg("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing({
      id: "",
      item_name: "",
      unit_price: "0.00",
      unit_cost: "0.00",
      quantity: "0",
      reorder_level: "0",
      is_active: true,
    });
    setSelected(null);
    setIsEditingDetails(true);
    setErrorMsg(null);
  }

  function openEdit(row: Products) {
    setEditing({
      ...row,
      unit_cost: row.unit_cost ?? "0.00",
    });
    setSelected(row);
    setIsEditingDetails(true);
    setErrorMsg(null);
  }

  function selectProduct(product: Products) {
    setSelected(product);
    setIsEditingDetails(false);
  }

  function updateField<K extends keyof Products>(key: K, value: Products[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function validateForm(data: Products) {
    // required fields
    const required: (keyof Products)[] = [
      "item_name",
      "unit_price",
      "unit_cost",
      "quantity",
      "reorder_level",
    ];

    for (const k of required) {
      const v = data[k];
      if (v === null || v === undefined || String(v).trim() === "") {
        return `Field ${k} is required`;
      }
    }

    // unit_price and unit_cost: numeric >= 0 with up to 2 decimals
    const moneyPattern = /^\d+(\.\d{1,2})?$/;
    if (!moneyPattern.test(data.unit_price))
      return "unit_price must be a non-negative number with up to 2 decimals";

    if (!moneyPattern.test(data.unit_cost))
      return "unit_cost must be a non-negative number with up to 2 decimals";

    if (Number(data.unit_price) < 0) return "unit_price cannot be negative";
    if (Number(data.unit_cost) < 0) return "unit_cost cannot be negative";

    // quantity & reorder_level: whole numbers, >= 0
    const wholePattern = /^\d+$/;
    if (!wholePattern.test(data.quantity))
      return "quantity must be a whole number >= 0";
    if (!wholePattern.test(data.reorder_level))
      return "reorder_level must be a whole number >= 0";

    if (Number(data.quantity) < 0) return "quantity cannot be negative";
    if (Number(data.reorder_level) < 0)
      return "reorder_level cannot be negative";

    return null;
  }

  async function save() {
    if (!editing) return;
    setErrorMsg(null);

    const data = { ...editing };

    const validation = validateForm(data);
    if (validation) {
      setErrorMsg(validation);
      console.error("Validation failed:", validation);
      return;
    }

    setSaving(true);
    try {
      // prepare payload: parse numeric strings to numbers
      const payload = {
        // keep id if present (empty string means create)
        ...(data.id ? { id: data.id } : {}),
        item_name: data.item_name.trim(),
        unit_price: Number(Number(data.unit_price).toFixed(2)),
        unit_cost: Number(Number(data.unit_cost).toFixed(2)),
        quantity: Number(Math.trunc(Number(data.quantity))),
        reorder_level: Number(Math.trunc(Number(data.reorder_level))),
        is_active: data.is_active,
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
      setIsEditingDetails(false);
      setEditing(null);
    } catch (err) {
      console.error("Save failed:", err);
      setErrorMsg("Failed to save products");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
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
      setIsEditingDetails(false);
      setEditing(null);
    } catch (err) {
      console.error("Remove failed:", err);
      setErrorMsg("Failed to remove products");
    } finally {
      setSaving(false);
    }
  }

  function openQuantityModal() {
    setQuantityModalOpen(true);
    setSelectedProductId("");
    setQuantityAdjustment("");
    setAdjustmentType("add");
    setErrorMsg(null);
  }

  async function adjustQuantity() {
    if (!selectedProductId || !quantityAdjustment) {
      setErrorMsg("Please select a product and enter an amount");
      return;
    }

    const amount = Number(quantityAdjustment);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg("Amount must be a positive number");
      return;
    }

    setErrorMsg(null);
    setSaving(true);

    try {
      const product = rows.find((r) => r.id === selectedProductId);
      if (!product) {
        throw new Error("Product not found");
      }

      const payload = {
        product_id: selectedProductId,
        adjustment_amount: amount,
        adjustment_type: adjustmentType,
        notes: null,
      };

      const res = await fetch("/api/manage/products/adjustQuantity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Server responded ${res.status}`);
      }

      // Reload products to show updated quantity
      await load();
      setQuantityModalOpen(false);
      setQuantityAdjustment("");
      setSelectedProductId("");
    } catch (err) {
      console.error("Quantity adjustment failed:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to adjust quantity"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {/* LEFT PANE - Products List */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col min-h-0">
          <div className="p-6 border-b border-gray-200 shrink-0">
            <h2 className="text-3xl font-bold mb-4">Products</h2>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredRows.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {rows.length === 0 ? "No products yet" : "No results"}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRows.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className={`p-4 cursor-pointer transition ${
                      selected?.id === product.id
                        ? "bg-blue-50 border-l-4 border-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {product.item_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ₱{product.unit_price}
                    </div>
                    <div className="text-xs text-gray-500">
                      Qty: {product.quantity}
                    </div>
                    {!product.is_active && (
                      <div className="text-xs text-red-600 mt-1">Inactive</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 shrink-0">
            <button
              onClick={openNew}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-base font-medium"
            >
              + Add New Product
            </button>
          </div>
        </div>

        {/* RIGHT PANE - Details or Edit */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col min-h-0">
          {isEditingDetails && editing ? (
            <EditPane
              product={editing}
              updateField={updateField}
              save={save}
              remove={remove}
              saving={saving}
              errorMsg={errorMsg}
              onCancel={() => {
                setIsEditingDetails(false);
                setEditing(null);
                setErrorMsg(null);
              }}
              isNewProduct={!editing.id}
            />
          ) : selected ? (
            <DetailsPane
              product={selected}
              onEdit={() => openEdit(selected)}
              onAdjustQuantity={openQuantityModal}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">📦</div>
                <p>Select a product to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quantity Adjustment Modal */}
      {quantityModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[480px] rounded-lg shadow-lg space-y-4">
            <div className="text-lg font-semibold text-gray-900">
              Adjust Product Quantity
            </div>

            {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}

            <div className="space-y-4">
              {/* Product Dropdown */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1 text-gray-700">
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="border border-gray-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a product --</option>
                  {rows.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.item_name} (Current: {product.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add/Subtract Toggle */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1 text-gray-700">
                  Action
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustmentType("add")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      adjustmentType === "add"
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Add (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType("subtract")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      adjustmentType === "subtract"
                        ? "bg-red-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Subtract (-)
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1 text-gray-700">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantityAdjustment}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "");
                    setQuantityAdjustment(cleaned);
                  }}
                  placeholder="Enter quantity to adjust"
                  className="border border-gray-300 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Preview */}
              {selectedProductId && quantityAdjustment && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">
                    Preview:
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    {(() => {
                      const product = rows.find(
                        (r) => r.id === selectedProductId
                      );
                      if (!product) return "";
                      const current = Number(product.quantity);
                      const amount = Number(quantityAdjustment);
                      const newQty =
                        adjustmentType === "add"
                          ? current + amount
                          : current - amount;
                      return `${product.item_name}: ${current} ${
                        adjustmentType === "add" ? "+" : "-"
                      } ${amount} = ${newQty}`;
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setQuantityModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={adjustQuantity}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={saving || !selectedProductId || !quantityAdjustment}
              >
                {saving ? "Adjusting..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Details Pane Component
function DetailsPane({
  product,
  onEdit,
  onAdjustQuantity,
}: {
  product: Products;
  onEdit: () => void;
  onAdjustQuantity: () => void;
}) {
  const margin = Number(product.unit_price) - Number(product.unit_cost);
  const marginPercent =
    Number(product.unit_price) > 0
      ? ((margin / Number(product.unit_price)) * 100).toFixed(1)
      : "0";
  const isLowStock = Number(product.quantity) < Number(product.reorder_level);

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              {product.item_name}
            </h1>
            <p className="text-gray-500 mt-1">Product ID: {product.id}</p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              product.is_active
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {product.is_active ? "✓ Active" : "✗ Inactive"}
          </span>
        </div>
      </div>

      {/* Pricing & Margin Info */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="text-sm text-gray-600 font-medium">Unit Cost</div>
          <div className="text-3xl font-bold text-blue-900 mt-2">
            ₱{product.unit_cost}
          </div>
        </div>
        <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="text-sm text-gray-600 font-medium">Unit Price</div>
          <div className="text-3xl font-bold text-green-900 mt-2">
            ₱{product.unit_price}
          </div>
        </div>
        <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="text-sm text-gray-600 font-medium">Margin</div>
          <div className="text-3xl font-bold text-purple-900 mt-2">
            ₱{margin.toFixed(2)}
          </div>
          <div className="text-xs text-gray-600 mt-1">{marginPercent}%</div>
        </div>
      </div>

      {/* Stock Info */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div
          className={`rounded-lg p-6 border-2 ${
            isLowStock
              ? "bg-orange-50 border-orange-300"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="text-sm text-gray-600 font-medium">
            Current Quantity
          </div>
          <div
            className={`text-3xl font-bold mt-2 ${
              isLowStock ? "text-orange-900" : "text-gray-900"
            }`}
          >
            {product.quantity}
          </div>
          {isLowStock && (
            <div className="text-xs text-orange-700 mt-2 font-medium">
              ⚠ Below reorder level
            </div>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="text-sm text-gray-600 font-medium">Reorder Level</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {product.reorder_level}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-auto pt-6 border-t border-gray-200">
        <button
          onClick={onAdjustQuantity}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Adjust Quantity
        </button>
        <button
          onClick={onEdit}
          className="flex-1 px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          Edit Product
        </button>
      </div>
    </div>
  );
}

// Edit Pane Component
function EditPane({
  product,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  onCancel,
  isNewProduct,
}: {
  product: Products;
  updateField: (key: keyof Products, value: any) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  saving: boolean;
  errorMsg: string | null;
  onCancel: () => void;
  isNewProduct: boolean;
}) {
  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">
        {isNewProduct ? "Add New Product" : "Edit Product"}
      </h2>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800 text-sm font-medium">{errorMsg}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-5 pr-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item Name
          </label>
          <input
            type="text"
            value={product.item_name}
            onChange={(e) => updateField("item_name", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Cost (₱)
            </label>
            <input
              type="number"
              step="0.01"
              value={product.unit_cost}
              onChange={(e) => updateField("unit_cost", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Price (₱)
            </label>
            <input
              type="number"
              step="0.01"
              value={product.unit_price}
              onChange={(e) => updateField("unit_price", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              step="1"
              value={product.quantity}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, "");
                updateField("quantity", cleaned === "" ? "0" : cleaned);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reorder Level
            </label>
            <input
              type="number"
              step="1"
              value={product.reorder_level}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, "");
                updateField("reorder_level", cleaned === "" ? "0" : cleaned);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <input
            type="checkbox"
            id="is_active"
            checked={product.is_active}
            onChange={(e) => updateField("is_active", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
          <label
            htmlFor="is_active"
            className="text-sm font-medium text-gray-700"
          >
            Active
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
        <button
          onClick={onCancel}
          className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-700 font-medium"
          disabled={saving}
        >
          Cancel
        </button>
        {!isNewProduct && (
          <button
            onClick={remove}
            className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            disabled={saving}
          >
            Delete
          </button>
        )}
        <button
          onClick={save}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving..." : isNewProduct ? "Add Product" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
