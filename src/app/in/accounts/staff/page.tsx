/**
 * Staff Management Page - Accounts Module
 *
 * Provides a table interface for managing laundry staff members including:
 * - Staff list with real-time search by name, email, phone
 * - Table display with columns for name, email, phone, role, status
 * - Create, edit, and delete staff with validation
 * - Role assignment (admin, cashier, attendant, rider, cashier_attendant)
 * - Centered modal for viewing/editing staff details
 *
 * Architecture Notes:
 * - Table view with pagination and search
 * - Details modal with view/edit modes
 * - Role data comes from staff_roles junction table (handled by API)
 */

"use client";

import { useEffect, useState } from "react";

// Staff type definition - represents a staff member record from the database
// The role field is populated from the staff_roles junction table by the API
type Staff = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: string | null;
  gender: "male" | "female" | null;
  role: "admin" | "cashier" | "attendant" | "rider" | "cashier_attendant";
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  is_active: boolean;
};

export default function StaffPage() {
  // State management for staff data and UI
  const [rows, setRows] = useState<Staff[]>([]); // All staff records from API
  const [filteredRows, setFilteredRows] = useState<Staff[]>([]); // Filtered by search query
  const [searchQuery, setSearchQuery] = useState(""); // Current search text
  const [editing, setEditing] = useState<Staff | null>(null); // Staff data being edited
  const [modalMode, setModalMode] = useState<"view" | "edit">("view"); // Modal view or edit mode
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Error message from save/delete
  const [successMsg, setSuccessMsg] = useState<string | null>(null); // Success message
  const [saving, setSaving] = useState(false); // Loading state during save/delete
  const [originalStaff, setOriginalStaff] = useState<Staff | null>(null); // Original data for change detection
  const [loading, setLoading] = useState(false); // Loading state for table

  // Load staff from database on component mount
  useEffect(() => {
    load();
  }, []);

  // Debounced search filter - updates filtered list when search query changes (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() === "") {
        setFilteredRows(rows);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = rows.filter((staff) => {
          const fullName =
            `${staff.first_name} ${staff.last_name}`.toLowerCase();
          const email = (staff.email_address || "").toLowerCase();
          const phone = (staff.phone_number || "").toLowerCase();
          return fullName.includes(query) || email.includes(query) || phone.includes(query);
        });
        setFilteredRows(filtered);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, rows]);

  // Fetch all staff from API and populate both rows and filteredRows
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/getStaffTable");
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setRows(data);
      setFilteredRows(data);
    } catch (error) {
      console.error("Failed to load staff:", error);
      setErrorMsg("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  // Initialize new staff form with default values
  function openNew() {
    const newStaff: Staff = {
      id: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      birthdate: "",
      gender: null,
      role: "cashier",
      address: "",
      phone_number: "",
      email_address: "",
      is_active: true,
    };
    setEditing(newStaff);
    setOriginalStaff(null);
    setModalMode("edit");
    setErrorMsg(null);
  }

  // Open staff in view mode
  function openView(staff: Staff) {
    setEditing(staff);
    setOriginalStaff(staff);
    setModalMode("view");
  }

  // Switch to edit mode
  function startEdit() {
    if (!editing) return;
    setEditing({ ...editing });
    setOriginalStaff({ ...editing });
    setModalMode("edit");
  }

  // Validate and save staff to database via API (create new or update existing)
  async function save() {
    if (!editing) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const data = { ...editing };
    // Validate required fields - email is only required for new staff
    const requiredFields: (keyof Staff)[] = [
      "first_name",
      "last_name",
      "birthdate",
      "gender",
      "role",
      "address",
      "phone_number",
    ];

    // Email is required only for new staff
    if (!editing.id) {
      requiredFields.push("email_address");
    }

    for (const field of requiredFields) {
      const value = data[field];
      if (value === null || value === undefined || value === "") {
        setErrorMsg(`${field.replace(/_/g, " ")} is required`);
        return;
      }
    }

    // Validate phone number (PH format)
    const phone = editing!.phone_number;
    const phonePattern = /^09\d{9}$/;
    if (!phonePattern.test(phone!)) {
      setErrorMsg("Phone number must start with 09 and have 11 digits");
      return;
    }

    // Validate email format if email is provided
    if (editing.email_address) {
      const email = editing!.email_address;
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email!)) {
        setErrorMsg("Email address is not valid");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff/saveStaff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save staff");

      setSuccessMsg(result.message || "Staff saved successfully");
      load(); // reload table
      setTimeout(() => {
        setEditing(null);
        setSuccessMsg(null);
      }, 2000);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMsg(msg);
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  }

  // Delete the selected staff member from the database
  async function remove() {
    if (!editing?.id) return;

    setSaving(true);
    try {
      const res = await fetch("/api/staff/removeStaff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete staff");

      setSuccessMsg("Staff deleted successfully");
      load(); // reload table
      setTimeout(() => {
        setEditing(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMsg(msg);
      console.error("Remove failed:", error);
    } finally {
      setSaving(false);
    }
  }

  // Update a single field in the editing staff object
  function updateField(key: keyof Staff, value: any) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Staff Management
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {filteredRows.length} staff member
              {filteredRows.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            + Add New Staff
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Error Message */}
        {errorMsg && !editing && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="text-red-800 text-xs font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="text-green-800 text-xs font-medium">{successMsg}</div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading staff...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {rows.length === 0
                ? "No staff yet. Create one to get started!"
                : "No results match your search."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {staff.first_name} {staff.last_name}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {staff.email_address || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {staff.phone_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {staff.role
                            .replace(/_/g, " ")
                            .split(" ")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
                            )
                            .join(" ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            staff.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {staff.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openView(staff)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Center Rectangle Modal */}
      {editing && (
        <StaffModal
          staff={editing}
          originalStaff={originalStaff}
          mode={modalMode}
          updateField={updateField}
          save={save}
          remove={remove}
          saving={saving}
          errorMsg={errorMsg}
          successMsg={successMsg}
          onCancel={() => {
            setEditing(null);
            setErrorMsg(null);
          }}
          onEdit={startEdit}
          isNewStaff={!editing.id}
        />
      )}
    </div>
  );
}

// Staff Modal - Centered Rectangle Modal
function StaffModal({
  staff,
  originalStaff,
  mode,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  successMsg,
  onCancel,
  onEdit,
  isNewStaff,
}: {
  staff: Staff;
  originalStaff: Staff | null;
  mode: "view" | "edit";
  updateField: (key: keyof Staff, value: any) => void;
  save: () => void;
  remove: () => void;
  saving: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  onCancel: () => void;
  onEdit: () => void;
  isNewStaff: boolean;
}) {
  const hasChanges =
    isNewStaff ||
    !originalStaff ||
    JSON.stringify(staff) !== JSON.stringify(originalStaff);

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-100 text-red-800",
      cashier: "bg-blue-100 text-blue-800",
      attendant: "bg-green-100 text-green-800",
      rider: "bg-purple-100 text-purple-800",
      cashier_attendant: "bg-indigo-100 text-indigo-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  if (mode === "view") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
            <h2 className="text-lg font-bold text-gray-900">
              {staff.first_name} {staff.last_name}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            {/* Role Badge */}
            <div className="mb-6">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(
                  staff.role
                )}`}
              >
                {staff.role
                  .replace(/_/g, " ")
                  .split(" ")
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join(" ")}
              </span>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  Email
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {staff.email_address || "—"}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  Phone
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {staff.phone_number || "—"}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  staff.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {staff.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Personal Information */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    First Name
                  </div>
                  <div className="text-gray-900 mt-1">{staff.first_name}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Middle Name
                  </div>
                  <div className="text-gray-900 mt-1">
                    {staff.middle_name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Last Name
                  </div>
                  <div className="text-gray-900 mt-1">{staff.last_name}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Birthdate
                  </div>
                  <div className="text-gray-900 mt-1">
                    {staff.birthdate || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">Gender</div>
                  <div className="text-gray-900 mt-1">
                    {staff.gender
                      ? staff.gender.charAt(0).toUpperCase() +
                        staff.gender.slice(1)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            {staff.address && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Address
                </h3>
                <p className="text-sm text-gray-700">{staff.address}</p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isNewStaff ? "Add New Staff" : "Edit Staff"}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              {successMsg}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="First Name"
                value={staff.first_name}
                onChange={(v) => updateField("first_name", v)}
              />
              <Field
                label="Middle Name"
                value={staff.middle_name ?? ""}
                onChange={(v) => updateField("middle_name", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Last Name"
                value={staff.last_name}
                onChange={(v) => updateField("last_name", v)}
              />
              <Field
                label="Birthdate"
                type="date"
                value={staff.birthdate ?? ""}
                onChange={(v) => updateField("birthdate", v)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Gender"
                value={staff.gender ?? ""}
                onChange={(v) => updateField("gender", v || null)}
                options={[
                  { value: "", label: "Select…" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
              />
              <Select
                label="Role"
                value={staff.role}
                onChange={(v) => updateField("role", v)}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "cashier", label: "Cashier" },
                  { value: "attendant", label: "Attendant" },
                  { value: "rider", label: "Rider" },
                  { value: "cashier_attendant", label: "Cashier & Attendant" },
                ]}
              />
            </div>

            <PhoneField
              label="Phone"
              value={staff.phone_number ?? ""}
              onChange={(v) => updateField("phone_number", v)}
            />

            <Field
              label="Email Address"
              value={staff.email_address ?? ""}
              onChange={(v) => updateField("email_address", v)}
            />

            <Field
              label="Address"
              value={staff.address ?? ""}
              onChange={(v) => updateField("address", v)}
            />

            {isNewStaff && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <strong>📧 Account Creation:</strong> An invitation link will be
                sent to the email address.
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={staff.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label className="text-xs font-medium text-gray-900">
                Staff member is active
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-2 justify-end shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          {!isNewStaff && (
            <button
              onClick={remove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              disabled={saving}
            >
              Delete
            </button>
          )}
          {hasChanges && (
            <button
              onClick={save}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving..." : isNewStaff ? "Add" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Philippine phone number field component with validation
function PhoneField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isValid = value === "" || /^09\d{9}$/.test(value);

  return (
    <div className="flex flex-col">
      <label className="text-xs font-semibold text-gray-900 mb-1">
        {label}
      </label>
      <input
        type="tel"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits.length <= 11) {
            onChange(digits);
          }
        }}
        maxLength={11}
        disabled={disabled}
        placeholder="09XXXXXXXXX"
        className={`border px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-gray-500 ${
          value && !isValid
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
      />
      {value && !isValid && (
        <p className="text-xs text-red-600 mt-1">
          Format: 09XXXXXXXXX (11 digits)
        </p>
      )}
    </div>
  );
}

// Reusable text input component for form fields
function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  max?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-semibold text-gray-900 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        max={max}
        className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

// Reusable dropdown select component for form fields
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-semibold text-gray-900 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
