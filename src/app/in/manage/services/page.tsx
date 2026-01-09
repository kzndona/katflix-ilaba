"use client";

import { useEffect, useState } from "react";
import { formatToPST } from "@/src/app/utils/dateUtils";

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
  const [filteredRows, setFilteredRows] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Service | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        const filtered = rows.filter((service) => {
          return (
            service.name.toLowerCase().includes(query) ||
            service.service_type.toLowerCase().includes(query)
          );
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
      setFilteredRows(normalized);
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
    setSelected(null);
    setIsEditingDetails(true);
    setErrorMsg(null);
  }

  function openEdit(row: Service) {
    setEditing(row);
    setSelected(row);
    setIsEditingDetails(true);
    setErrorMsg(null);
  }

  function selectService(service: Service) {
    setSelected(service);
    setIsEditingDetails(false);
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
      setIsEditingDetails(false);
      setEditing(null);
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
      setIsEditingDetails(false);
      setEditing(null);
    } catch {
      setErrorMsg("Failed to remove service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {/* LEFT PANE - Services List */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col min-h-0">
          <div className="p-6 border-b border-gray-200 shrink-0">
            <h2 className="text-3xl font-bold mb-4">Services</h2>
            <input
              type="text"
              placeholder="Search by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredRows.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {rows.length === 0 ? "No services yet" : "No results"}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRows.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => selectService(service)}
                    className={`p-4 cursor-pointer transition ${
                      selected?.id === service.id
                        ? "bg-blue-50 border-l-4 border-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">
                      {service.service_type}
                    </div>
                    {service.rate_per_kg && (
                      <div className="text-xs text-gray-500 mt-1">
                        ₱{service.rate_per_kg}/kg
                      </div>
                    )}
                    {!service.is_active && (
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
              + Add New Service
            </button>
          </div>
        </div>

        {/* RIGHT PANE - Details or Edit */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col min-h-0">
          {isEditingDetails && editing ? (
            <EditPane
              service={editing}
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
              isNewService={!editing.id}
            />
          ) : selected ? (
            <DetailsPane 
              service={selected}
              onEdit={() => openEdit(selected)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">🔧</div>
                <p>Select a service to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Details Pane Component
function DetailsPane({
  service,
  onEdit,
}: {
  service: Service;
  onEdit: () => void;
}) {
  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{service.name}</h1>
            <p className="text-gray-500 mt-1">Service ID: {service.id}</p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              service.is_active
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {service.is_active ? "✓ Active" : "✗ Inactive"}
          </span>
        </div>
      </div>

      {/* Service Type */}
      <div className="mb-8">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="text-sm text-gray-600 font-medium">Service Type</div>
          <div className="text-2xl font-bold text-blue-900 mt-2 capitalize">
            {service.service_type}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {service.rate_per_kg && (
          <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-sm text-gray-600 font-medium">Rate per KG</div>
            <div className="text-3xl font-bold text-green-900 mt-2">
              ₱{service.rate_per_kg}
            </div>
          </div>
        )}
        {service.base_duration_minutes && (
          <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="text-sm text-gray-600 font-medium">Base Duration</div>
            <div className="text-3xl font-bold text-purple-900 mt-2">
              {service.base_duration_minutes}
            </div>
            <div className="text-xs text-gray-600 mt-1">minutes</div>
          </div>
        )}
      </div>

      {/* Description */}
      {service.description && (
        <div className="mb-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-3">Description</div>
          <p className="text-gray-700 text-sm leading-relaxed">
            {service.description}
          </p>
        </div>
      )}

      {/* Action Button */}
      <div className="flex gap-3 mt-auto pt-6 border-t border-gray-200">
        <button
          onClick={onEdit}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Edit Service
        </button>
      </div>
    </div>
  );
}

// Edit Pane Component
function EditPane({
  service,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  onCancel,
  isNewService,
}: {
  service: Service;
  updateField: (key: keyof Service, value: any) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  saving: boolean;
  errorMsg: string | null;
  onCancel: () => void;
  isNewService: boolean;
}) {
  const serviceTypes = ["wash", "spin", "dry", "iron", "fold", "pickup", "delivery"];

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">
        {isNewService ? "Add New Service" : "Edit Service"}
      </h2>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800 text-sm font-medium">{errorMsg}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-5 pr-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Type
          </label>
          <select
            value={service.service_type}
            onChange={(e) => updateField("service_type", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a type --</option>
            {serviceTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={service.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={service.description ?? ""}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Duration (minutes)
            </label>
            <input
              type="number"
              value={service.base_duration_minutes ?? ""}
              onChange={(e) =>
                updateField("base_duration_minutes", e.target.value === "" ? "" : e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate per KG (₱)
            </label>
            <input
              type="number"
              step="0.01"
              value={service.rate_per_kg ?? ""}
              onChange={(e) =>
                updateField("rate_per_kg", e.target.value === "" ? "" : e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <input
            type="checkbox"
            id="is_active"
            checked={service.is_active}
            onChange={(e) => updateField("is_active", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
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
        {!isNewService && (
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
          {saving ? "Saving..." : isNewService ? "Add Service" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
