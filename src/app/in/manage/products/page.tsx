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
  const [modalOpen, setModalOpen] = useState(false);
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
    setModalOpen(true);
    setErrorMsg(null);
  }

  function openEdit(row: Products) {
    setEditing({
      ...row,
      unit_cost: row.unit_cost ?? "0.00",
    });
    setModalOpen(true);
    setErrorMsg(null);
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
      setModalOpen(false);
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
      setModalOpen(false);
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to adjust quantity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Products</div>
        <div className="flex gap-2">
          <button
            onClick={openQuantityModal}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Adjust Quantity
          </button>
          <button
            onClick={openNew}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add New
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : errorMsg ? (
        <div className="text-red-600">{errorMsg}</div>
      ) : (
        <table className="w-full table-fixed border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Item</th>
              <th className="p-2 border">Unit Cost</th>
              <th className="p-2 border">Unit Price</th>
              <th className="p-2 border">Quantity</th>
              <th className="p-2 border">Reorder Level</th>
              <th className="p-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => openEdit(r)}
              >
                <td className="p-2 border truncate text-center">
                  {r.item_name}
                </td>
                <td className="p-2 border text-right">₱{r.unit_cost}</td>
                <td className="p-2 border text-right">₱{r.unit_price}</td>
                <td className="p-2 border text-center">{r.quantity}</td>
                <td className="p-2 border text-center">{r.reorder_level}</td>
                <td className="p-2 border text-center">
                  {r.is_active ? "✓ Active" : "✗ Inactive"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[560px] rounded shadow space-y-4">
            <div className="text-lg font-semibold">
              {editing.id ? "Edit Product" : "Add Product"}
            </div>

            {errorMsg && <div className="text-red-600">{errorMsg}</div>}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <Field
                label="Item Name"
                value={editing.item_name}
                onChange={(v) => updateField("item_name", v)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Unit Cost"
                  value={editing.unit_cost}
                  type="number"
                  step="0.01"
                  onChange={(v) => updateField("unit_cost", v)}
                />
                <Field
                  label="Unit Price"
                  value={editing.unit_price}
                  type="number"
                  step="0.01"
                  onChange={(v) => updateField("unit_price", v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Quantity"
                  value={editing.quantity}
                  type="number"
                  step="1"
                  onChange={(v) => {
                    // keep only digits for whole numbers
                    const cleaned = v.replace(/\D/g, "");
                    updateField("quantity", cleaned === "" ? "0" : cleaned);
                  }}
                />
                <Field
                  label="Reorder Level"
                  value={editing.reorder_level}
                  type="number"
                  step="1"
                  onChange={(v) => {
                    const cleaned = v.replace(/\D/g, "");
                    updateField(
                      "reorder_level",
                      cleaned === "" ? "0" : cleaned
                    );
                  }}
                />
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm">Active</label>
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => updateField("is_active", e.target.checked)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 border rounded"
                disabled={saving}
              >
                Cancel
              </button>

              {editing.id && (
                <button
                  onClick={remove}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                  disabled={saving}
                >
                  Delete
                </button>
              )}

              <button
                onClick={save}
                className="px-3 py-1 bg-green-600 text-white rounded"
                disabled={saving}
              >
                {saving ? "Saving..." : editing.id ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Adjustment Modal */}
      {quantityModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[480px] rounded shadow space-y-4">
            <div className="text-lg font-semibold">Adjust Product Quantity</div>

            {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}

            <div className="space-y-4">
              {/* Product Dropdown */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <label className="text-sm font-medium mb-1">Action</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustmentType("add")}
                    className={`flex-1 px-4 py-2 rounded font-medium transition ${
                      adjustmentType === "add"
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Add (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType("subtract")}
                    className={`flex-1 px-4 py-2 rounded font-medium transition ${
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
                <label className="text-sm font-medium mb-1">Amount</label>
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
                  className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Preview */}
              {selectedProductId && quantityAdjustment && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
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
                      return `${product.item_name}: ${current} ${adjustmentType === "add" ? "+" : "-"} ${amount} = ${newQty}`;
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setQuantityModalOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={adjustQuantity}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm">{label}</label>
      <input
        type={type}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="border px-2 py-1 rounded"
      />
    </div>
  );
}
