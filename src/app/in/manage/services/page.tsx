"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  service_type: string;
  name: string;
  description: string | null;
  base_duration_minutes: string | null;
  rate_per_kg: string | null;
  is_active: boolean;
};

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
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
      const res = await fetch("/api/manage/services/getServices");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const normalized: Service[] = (data || []).map((r: any) => ({
        id: r.id,
        service_type: r.service_type ?? "",
        name: r.name ?? "",
        description: r.description ?? null,
        base_duration_minutes:
          r.base_duration_minutes !== null
            ? String(r.base_duration_minutes)
            : null,
        rate_per_kg: r.rate_per_kg !== null ? String(r.rate_per_kg) : null,
        is_active: r.is_active ?? true,
      }));
      setRows(normalized);
    } catch {
      setErrorMsg("Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing({
      id: "",
      service_type: "wash",
      name: "",
      description: "",
      base_duration_minutes: "",
      rate_per_kg: "",
      is_active: true,
    });
    setModalOpen(true);
    setErrorMsg(null);
  }

  function openEdit(row: Service) {
    setEditing(row);
    setModalOpen(true);
    setErrorMsg(null);
  }

  function updateField<K extends keyof Service>(key: K, value: Service[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function validateForm(data: Service) {
    if (!data.service_type.trim()) return "service_type is required";
    if (!data.name.trim()) return "name is required";
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
        service_type: editing.service_type.trim(),
        name: editing.name.trim(),
        description: editing.description?.trim() || null,
        base_duration_minutes:
          editing.base_duration_minutes === ""
            ? null
            : Number(editing.base_duration_minutes),
        rate_per_kg:
          editing.rate_per_kg === "" ? null : Number(editing.rate_per_kg),
        is_active: editing.is_active,
      };

      const res = await fetch("/api/manage/services/saveService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || `Server responded ${res.status}`);

      await load();
      setModalOpen(false);
    } catch {
      setErrorMsg("Failed to save service");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/manage/services/removeService", {
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
      setErrorMsg("Failed to remove service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Services</div>
        <button
          onClick={openNew}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Add New
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : errorMsg ? (
        <div className="text-red-600">{errorMsg}</div>
      ) : (
        <table className="w-full table-fixed border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Active</th>
              <th className="p-2 border">Rate/kg</th>
              <th className="p-2 border">Base Duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => openEdit(r)}
              >
                <td className="p-2 border text-center">{r.service_type}</td>
                <td className="p-2 border text-center">{r.name}</td>
                <td className="p-2 border text-center">
                  {r.is_active ? "Yes" : "No"}
                </td>
                <td className="p-2 border text-center">
                  {r.rate_per_kg ?? "-"}
                </td>
                <td className="p-2 border text-center">
                  {r.base_duration_minutes ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[500px] rounded shadow space-y-4">
            <div className="text-lg font-semibold">
              {editing.id ? "Edit Service" : "Add Service"}
            </div>

            {errorMsg && <div className="text-red-600">{errorMsg}</div>}

            <div className="space-y-3">
              <Field
                label="Service Type"
                value={editing.service_type}
                onChange={(v) => updateField("service_type", v)}
              />

              <Field
                label="Name"
                value={editing.name}
                onChange={(v) => updateField("name", v)}
              />

              <Field
                label="Description"
                value={editing.description ?? ""}
                onChange={(v) => updateField("description", v)}
              />

              <Field
                label="Base Duration (minutes)"
                value={editing.base_duration_minutes ?? ""}
                onChange={(v) =>
                  updateField("base_duration_minutes", v === "" ? "" : v)
                }
                type="number"
              />

              <Field
                label="Rate Per KG"
                value={editing.rate_per_kg ?? ""}
                onChange={(v) => updateField("rate_per_kg", v === "" ? "" : v)}
                type="number"
              />

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
