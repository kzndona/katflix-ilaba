"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  service_type: string;
  name: string;
  description: string | null;
  tier: "basic" | "premium" | null;
  modifiers: any;
  sort_order: number;
  image_url: string | null;
  base_price: string | null;
  base_duration_minutes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
};

type SortConfig = {
  key: keyof Service;
  direction: "asc" | "desc";
};

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  const [filteredRows, setFilteredRows] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "sort_order",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ROWS_PER_PAGE = 10;

  useEffect(() => {
    load();
  }, []);

  // Apply search and sort
  useEffect(() => {
    const timer = setTimeout(() => {
      let result = rows;

      // Search
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        result = result.filter((service) => {
          return (
            service.name.toLowerCase().includes(query) ||
            service.service_type.toLowerCase().includes(query) ||
            service.description?.toLowerCase().includes(query) ||
            String(service.sort_order).includes(query) ||
            (service.created_at?.toLowerCase().includes(query) ?? false) ||
            (service.updated_at?.toLowerCase().includes(query) ?? false) ||
            (service.updated_by?.toLowerCase().includes(query) ?? false)
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
          return sortConfig.direction === "asc"
            ? aVal - (bVal as number)
            : (bVal as number) - aVal;
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
      const res = await fetch("/api/manage/services/getServices");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const json = await res.json();
      const data = json.data || json;
      const normalized: Service[] = (data || []).map((r: any) => ({
        id: r.id,
        service_type: r.service_type ?? "",
        name: r.name ?? "",
        description: r.description ?? null,
        tier: r.tier ?? null,
        modifiers: r.modifiers ?? null,
        sort_order: r.sort_order ?? 0,
        image_url: r.image_url ?? null,
        base_price:
          r.base_price !== null && r.base_price !== undefined
            ? String(r.base_price)
            : null,
        base_duration_minutes:
          r.base_duration_minutes !== null &&
          r.base_duration_minutes !== undefined
            ? String(r.base_duration_minutes)
            : null,
        is_active: r.is_active ?? true,
        created_at: r.created_at ?? undefined,
        updated_at: r.updated_at ?? undefined,
        updated_by: r.updated_by ?? undefined,
      }));
      setRows(normalized);
      setFilteredRows(normalized);
    } catch (err) {
      console.error(err);
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
      tier: null,
      modifiers: null,
      sort_order: rows.length,
      image_url: null,
      base_price: "",
      base_duration_minutes: "",
      is_active: true,
    });
    setErrorMsg(null);
  }

  function openEdit(row: Service) {
    setEditing(row);
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
        tier: editing.tier || null,
        modifiers: editing.modifiers || null,
        sort_order: editing.sort_order,
        image_url: editing.image_url || null,
        base_price:
          editing.base_price === "" ? null : Number(editing.base_price),
        base_duration_minutes:
          editing.base_duration_minutes === ""
            ? null
            : Number(editing.base_duration_minutes),
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
      setEditing(null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save service");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    if (!confirm("Are you sure you want to delete this service?")) return;

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
      setEditing(null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to remove service");
    } finally {
      setSaving(false);
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  const handleSort = (key: keyof Service) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: keyof Service }) => {
    if (sortConfig.key !== field)
      return <span className="text-gray-300">⇅</span>;
    return <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Services Management
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {filteredRows.length} service
              {filteredRows.length !== 1 ? "s" : ""} found
              {filteredRows.length > ROWS_PER_PAGE && (
                <>
                  {" "}
                  • Page {currentPage} of{" "}
                  {Math.ceil(filteredRows.length / ROWS_PER_PAGE)}
                </>
              )}
            </p>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            + Create New Service
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, type, order, date, updater..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="text-red-800 text-xs font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading services...
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {rows.length === 0
                ? "No services yet. Create one to get started!"
                : "No results match your search."}
            </div>
          ) : (
            <>
              {/* Table Wrapper with Horizontal Scroll */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Name <SortIcon field="name" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("service_type")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Type <SortIcon field="service_type" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("tier")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Tier <SortIcon field="tier" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("base_price")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Base Price <SortIcon field="base_price" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("base_duration_minutes")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Duration <SortIcon field="base_duration_minutes" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("created_at")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Created <SortIcon field="created_at" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("updated_at")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Updated <SortIcon field="updated_at" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("updated_by")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Updated By <SortIcon field="updated_by" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("is_active")}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Status <SortIcon field="is_active" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-sm text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((service, idx) => (
                      <tr
                        key={service.id}
                        className="border-b border-gray-200 hover:bg-blue-50 transition"
                      >
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {service.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                          {service.service_type}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {service.tier ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                service.tier === "basic"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {service.tier.charAt(0).toUpperCase() +
                                service.tier.slice(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-green-700">
                          {service.base_price
                            ? `₱${parseFloat(service.base_price).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {service.base_duration_minutes
                            ? `${service.base_duration_minutes} min`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {service.created_at
                            ? new Date(service.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {service.updated_at
                            ? new Date(service.updated_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {service.updated_by || "—"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {service.is_active ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                              ✓ Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                              ✗ Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => openEdit(service)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal - Slide from Right */}
      {editing && (
        <EditModal
          service={editing}
          updateField={updateField}
          save={save}
          remove={remove}
          saving={saving}
          errorMsg={errorMsg}
          onClose={() => {
            setEditing(null);
            setErrorMsg(null);
          }}
          isNewService={!editing.id}
        />
      )}
    </div>
  );
}

// Edit Modal Component
function EditModal({
  service,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  onClose,
  isNewService,
}: {
  service: Service;
  updateField: (key: keyof Service, value: any) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  saving: boolean;
  errorMsg: string | null;
  onClose: () => void;
  isNewService: boolean;
}) {
  const serviceTypes = [
    "wash",
    "spin",
    "dry",
    "iron",
    "fold",
    "pickup",
    "delivery",
  ];

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
            {isNewService ? "Add New Service" : "Edit Service"}
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

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={service.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Basic Wash"
              />
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Service Type <span className="text-red-600">*</span>
              </label>
              <select
                value={service.service_type}
                onChange={(e) => updateField("service_type", e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a type --</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Description
              </label>
              <textarea
                value={service.description ?? ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Details about this service..."
              />
            </div>

            {/* Tier */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Tier (Optional)
              </label>
              <select
                value={service.tier || ""}
                onChange={(e) =>
                  updateField(
                    "tier",
                    e.target.value === "" ? null : (e.target.value as any),
                  )
                }
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            {/* Base Price */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Base Price (₱) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={service.base_price ?? ""}
                onChange={(e) =>
                  updateField(
                    "base_price",
                    e.target.value === "" ? "" : e.target.value,
                  )
                }
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Base Duration */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Base Duration (Minutes)
              </label>
              <input
                type="number"
                value={service.base_duration_minutes ?? ""}
                onChange={(e) =>
                  updateField(
                    "base_duration_minutes",
                    e.target.value === "" ? "" : e.target.value,
                  )
                }
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 30"
              />
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={service.sort_order}
                onChange={(e) =>
                  updateField("sort_order", parseInt(e.target.value, 10) || 0)
                }
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Image URL (Optional)
              </label>
              <input
                type="text"
                value={service.image_url ?? ""}
                onChange={(e) =>
                  updateField("image_url", e.target.value || null)
                }
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            {/* Modifiers */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Modifiers (JSON - Optional)
              </label>
              <textarea
                value={
                  service.modifiers
                    ? JSON.stringify(service.modifiers, null, 2)
                    : ""
                }
                onChange={(e) => {
                  try {
                    const parsed =
                      e.target.value.trim() === ""
                        ? null
                        : JSON.parse(e.target.value);
                    updateField("modifiers", parsed);
                  } catch {
                    // Invalid JSON, user is still typing
                  }
                }}
                rows={2}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                placeholder='{"addon": "value"}'
              />
            </div>

            {/* Active Checkbox */}
            <div className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id="is_active"
                checked={service.is_active}
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
          {!isNewService && (
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
            {saving ? "Saving..." : isNewService ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
