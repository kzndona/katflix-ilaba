// app/in/accounts/staff/page.tsx
"use client";

import { useEffect, useState } from "react";

type Staff = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: string | null;
  gender: "male" | "female" | null;
  role: "admin" | "cashier" | "attendant" | "rider";
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  is_active: boolean;
};

export default function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Get staff data on load
  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/staff/getStaffTable");
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setRows(data);
    } catch (error) {
      console.error("Failed to load staff:", error);
      // TODO: SHOW AN ERROR STATE IN THE UI
    }
  }

  // Open modal for new staff
  function openNew() {
    setEditing({
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
    });
    setModalOpen(true);
  }

  // Open modal for editing existing staff
  function openEdit(row: Staff) {
    setEditing(row);
    setModalOpen(true);
  }

  async function save() {
    if (!editing) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const data = { ...editing };
    // Validate required fields
    const requiredFields: (keyof Staff)[] = [
      "first_name",
      "last_name",
      "birthdate",
      "gender",
      "role",
      "address",
      "phone_number",
      "email_address",
    ];

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

    // Validate email format
    const email = editing!.email_address;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email!)) {
      setErrorMsg("Email address is not valid");
      return;
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
        setModalOpen(false);
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
        setModalOpen(false);
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

  // Update a field in the editing staff
  function updateField(key: keyof Staff, value: any) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Staff</div>
        <button
          onClick={openNew}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Add New
        </button>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border w-1/6">First Name</th>
            <th className="p-2 border w-1/6">Last Name</th>
            <th className="p-2 border w-1/9">Birthdate</th>
            <th className="p-2 border w-1/9">Gender</th>
            <th className="p-2 border w-1/9">Role</th>
            <th className="p-2 border w-1.5/12">Phone Number</th>
            <th className="p-2 border w-1.5/12">Email Address</th>
            <th className="p-2 border">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => openEdit(r)}
            >
              <td className="p-2 border text-center">{r.first_name}</td>
              <td className="p-2 border text-center">{r.last_name}</td>
              <td className="p-2 border text-center">{r.birthdate}</td>
              <td className="p-2 border text-center">{r.gender}</td>
              <td className="p-2 border text-center">{r.role}</td>
              <td className="p-2 border text-center">{r.phone_number}</td>
              <td className="p-2 border text-center">{r.email_address}</td>
              <td className="p-2 border text-center">
                {r.is_active ? "Yes" : "No"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-[450px] rounded shadow space-y-4">
            <div className="text-lg font-semibold">
              {editing.id ? "Edit Staff" : "Add Staff"}
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 border border-green-300 rounded p-3 text-sm text-green-700">
                {successMsg}
              </div>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <Field
                label="First Name"
                value={editing.first_name}
                onChange={(v) => updateField("first_name", v)}
              />
              <Field
                label="Middle Name"
                value={editing.middle_name ?? ""}
                onChange={(v) => updateField("middle_name", v)}
              />
              <Field
                label="Last Name"
                value={editing.last_name}
                onChange={(v) => updateField("last_name", v)}
              />
              <Field
                label="Birthdate"
                type="date"
                value={editing.birthdate ?? ""}
                onChange={(v) => updateField("birthdate", v)}
              />

              <Select
                label="Gender"
                value={editing.gender ?? ""}
                onChange={(v) => updateField("gender", v || null)}
                options={[
                  { value: "", label: "Select…" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
              />

              <Select
                label="Role"
                value={editing.role}
                onChange={(v) => updateField("role", v)}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "cashier", label: "Cashier" },
                  { value: "attendant", label: "Attendant" },
                  { value: "rider", label: "Rider" },
                ]}
              />

              <Field
                label="Address"
                value={editing.address ?? ""}
                onChange={(v) => updateField("address", v)}
              />
              <Field
                label="Phone"
                value={editing.phone_number ?? ""}
                onChange={(v) => updateField("phone_number", v)}
              />
              <Field
                label="Email Address"
                value={editing.email_address ?? ""}
                onChange={(v) => updateField("email_address", v)}
              />

              {!editing.id && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                  <strong>📧 Account Creation:</strong> An invitation link will
                  be sent to the email address. Staff can set their password and
                  activate their account through the link.
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => updateField("is_active", e.target.checked)}
                />
                <label>Active</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 border rounded disabled:opacity-50"
                disabled={saving}
              >
                Cancel
              </button>

              {editing.id && (
                <button
                  onClick={remove}
                  className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                  disabled={saving}
                >
                  Delete
                </button>
              )}

              <button
                onClick={save}
                className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
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

// Simple reusable input field
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

// Simple select component
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
      <label className="text-sm">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border px-2 py-1 rounded"
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
