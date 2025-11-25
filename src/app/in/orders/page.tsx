"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  source: string;
  customer_id: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  discount: number;
  pickup_address: string | null;
  delivery_address: string | null;
  shipping_fee: number;
  created_at: string | null;
  completed_at: string | null;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/orders/getOrders");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const normalized: Order[] = (data || []).map((r: any) => ({
        id: r.id,
        source: r.source ?? "",
        customer_id: r.customer_id ?? null,
        status: r.status ?? "",
        payment_status: r.payment_status ?? "",
        total_amount: r.total_amount ?? 0,
        discount: r.discount ?? 0,
        pickup_address: r.pickup_address ?? null,
        delivery_address: r.delivery_address ?? null,
        shipping_fee: r.shipping_fee ?? 0,
        created_at: r.created_at ?? null,
        completed_at: r.completed_at ?? null,
      }));
      setRows(normalized);
    } catch (err) {
      setErrorMsg("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row: Order) {
    setEditing(row);
    setModalOpen(true);
    setErrorMsg(null);
  }

  function updateField<K extends keyof Order>(key: K, value: Order[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function validateForm(data: Order) {
    if (!data.source.trim()) return "Source is required";
    if (!data.status.trim()) return "Status is required";
    if (!data.payment_status.trim()) return "Payment status is required";
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
        ...editing,
      };

      const res = await fetch("/api/orders/saveOrder", {
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
      setErrorMsg("Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/orders/removeOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      await load();
      setModalOpen(false);
    } catch {
      setErrorMsg("Failed to remove order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Orders</div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : errorMsg ? (
        <div className="text-red-600">{errorMsg}</div>
      ) : (
        <table className="w-full table-fixed border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Source</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Payment</th>
              <th className="p-2 border">Total</th>
              <th className="p-2 border">Pickup Address</th>
              <th className="p-2 border">Delivery Address</th>
              <th className="p-2 border">Created At</th>
              <th className="p-2 border">Completed At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => openEdit(r)}
              >
                <td className="p-2 border text-center">{r.source}</td>
                <td className="p-2 border text-center">{r.status}</td>
                <td className="p-2 border text-center">{r.payment_status}</td>
                <td className="p-2 border text-center">
                  {r.total_amount.toFixed(2)}
                </td>
                <td className="p-2 border text-center">
                  {r.pickup_address ?? "-"}
                </td>
                <td className="p-2 border text-center">
                  {r.delivery_address ?? "-"}
                </td>
                <td className="p-2 border text-center">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                </td>
                <td className="p-2 border text-center">
                  {r.completed_at
                    ? new Date(r.completed_at).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[600px] rounded shadow space-y-4">
            <div className="text-lg font-semibold">
              {editing.id ? "Edit Order" : "Add Order"}
            </div>

            {errorMsg && <div className="text-red-600">{errorMsg}</div>}

            <div className="space-y-3">
              <SelectField
                label="Source"
                value={editing.source}
                onChange={(v) => updateField("source", v)}
                options={["pos", "mobile"]}
              />

              <SelectField
                label="Status"
                value={editing.status}
                onChange={(v) => updateField("status", v)}
                options={[
                  "processing",
                  "pick-up",
                  "delivering",
                  "completed",
                  "cancelled",
                ]}
              />

              <SelectField
                label="Payment Status"
                value={editing.payment_status}
                onChange={(v) => updateField("payment_status", v)}
                options={["processing", "successful", "failed"]}
              />

              <Field
                label="Total Amount"
                value={editing.total_amount.toString()}
                onChange={(v) => updateField("total_amount", parseFloat(v))}
                type="number"
              />

              <Field
                label="Discount"
                value={editing.discount.toString()}
                onChange={(v) => updateField("discount", parseFloat(v))}
                type="number"
              />

              <Field
                label="Shipping Fee"
                value={editing.shipping_fee.toString()}
                onChange={(v) => updateField("shipping_fee", parseFloat(v))}
                type="number"
              />

              <Field
                label="Pickup Address"
                value={editing.pickup_address ?? ""}
                onChange={(v) => updateField("pickup_address", v)}
              />

              <Field
                label="Delivery Address"
                value={editing.delivery_address ?? ""}
                onChange={(v) => updateField("delivery_address", v)}
              />
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
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border px-2 py-1 rounded"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border px-2 py-1 rounded"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
