"use client";

import { useEffect, useState } from "react";

type Machine = {
  id: string;
  machine_name: string;
  type: string;
  status: string;
  last_serviced_at: string | null;
};

export default function MachinesPage() {
  const [rows, setRows] = useState<Machine[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
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
      const res = await fetch("/api/machines/getMachines");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const normalized: Machine[] = (data || []).map((r: any) => ({
        id: r.id,
        machine_name: r.machine_name ?? "",
        type: r.type ?? "",
        status: r.status ?? "",
        last_serviced_at: r.last_serviced_at ?? null,
      }));
      setRows(normalized);
    } catch (err) {
      setErrorMsg("Failed to load machines");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing({
      id: "",
      machine_name: "",
      type: "",
      status: "available",
      last_serviced_at: null,
    });
    setModalOpen(true);
    setErrorMsg(null);
  }

  function openEdit(row: Machine) {
    setEditing(row);
    setModalOpen(true);
    setErrorMsg(null);
  }

  function updateField<K extends keyof Machine>(key: K, value: Machine[K]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function validateForm(data: Machine) {
    if (!data.machine_name.trim()) return "machine_name is required";
    if (!data.type.trim()) return "type is required";
    if (!data.status.trim()) return "status is required";
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
        machine_name: editing.machine_name.trim(),
        type: editing.type.trim(),
        status: editing.status.trim(),
        last_serviced_at: editing.last_serviced_at,
      };

      const res = await fetch("/api/machines/saveMachine", {
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
      setErrorMsg("Failed to save machine");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/machines/removeMachine", {
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
      setErrorMsg("Failed to remove machine");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Machines</div>
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
              <th className="p-2 border">Machine</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Last Serviced</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => openEdit(r)}
              >
                <td className="p-2 border text-center">{r.machine_name}</td>
                <td className="p-2 border text-center">{r.type}</td>
                <td className="p-2 border text-center">{r.status}</td>
                <td className="p-2 border text-center">
                  {r.last_serviced_at
                    ? new Date(r.last_serviced_at).toLocaleString()
                    : "-"}
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
              {editing.id ? "Edit Machine" : "Add Machine"}
            </div>

            {errorMsg && <div className="text-red-600">{errorMsg}</div>}

            <div className="space-y-3">
              <Field
                label="Machine Name"
                value={editing.machine_name}
                onChange={(v) => updateField("machine_name", v)}
              />

              <Field
                label="Type"
                value={editing.type}
                onChange={(v) => updateField("type", v)}
              />

              <Field
                label="Status"
                value={editing.status}
                onChange={(v) => updateField("status", v)}
              />

              <Field
                label="Last Serviced At"
                value={editing.last_serviced_at ?? ""}
                onChange={(v) =>
                  updateField("last_serviced_at", v === "" ? null : v)
                }
                type="datetime-local"
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
