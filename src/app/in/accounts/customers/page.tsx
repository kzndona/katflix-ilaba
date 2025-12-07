// app/in/accounts/customers/page.tsx
"use client";

import { useEffect, useState } from "react";

type Customer = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthdate: string | null;
  gender: "male" | "female" | null;
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  loyalty_points: number | null;
  is_active?: boolean;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [filteredRows, setFilteredRows] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [originalCustomer, setOriginalCustomer] = useState<Customer | null>(
    null
  );

  // Get customers data on load
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
        const filtered = rows.filter((customer) => {
          const fullName =
            `${customer.first_name} ${customer.last_name}`.toLowerCase();
          return fullName.includes(query);
        });
        setFilteredRows(filtered);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, rows]);

  async function load() {
    try {
      const res = await fetch("/api/customer/getCustomersTable");
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setRows(data);
      setFilteredRows(data);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  }

  // Create new customer
  function openNew() {
    const newCustomer: Customer = {
      id: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      birthdate: "",
      gender: null,
      address: "",
      phone_number: "",
      email_address: "",
      loyalty_points: 0,
    };
    setEditing(newCustomer);
    setOriginalCustomer(null);
    setSelected(null);
    setIsEditingDetails(true);
  }

  // Select customer to view details
  function selectCustomer(customer: Customer) {
    setSelected(customer);
    setIsEditingDetails(false);
  }

  // Start editing the selected customer
  function startEdit() {
    if (!selected) return;
    setEditing({ ...selected });
    setOriginalCustomer({ ...selected });
    setIsEditingDetails(true);
  }

  async function save() {
    if (!editing) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const data = { ...editing };
    // Validate required fields
    const requiredFields: (keyof Customer)[] = [
      "first_name",
      "last_name",
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
      const res = await fetch("/api/customer/saveCustomer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save customer");

      setSuccessMsg(result.message || "Customer saved successfully");
      load(); // reload table
      setTimeout(() => {
        setIsEditingDetails(false);
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

  async function remove() {
    if (!editing?.id) return;

    setSaving(true);
    try {
      const res = await fetch("/api/customer/removeCustomer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete customer");

      setSuccessMsg("Customer deleted successfully");
      load(); // reload table
      setTimeout(() => {
        setIsEditingDetails(false);
        setEditing(null);
        setSelected(null);
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

  // Update a field in the editing customer
  function updateField(key: keyof Customer, value: any) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  return (
    <div className="p-6 h-screen bg-gray-50 flex flex-col">
      <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
        {/* LEFT PANE - Customers List */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-3xl font-bold mb-4">Customers</h2>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredRows.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {rows.length === 0 ? "No customers yet" : "No results"}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRows.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className={`p-4 cursor-pointer transition ${
                      selected?.id === customer.id
                        ? "bg-blue-50 border-l-4 border-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {customer.first_name} {customer.last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {customer.email_address}
                    </div>
                    {customer.loyalty_points !== null &&
                      customer.loyalty_points > 0 && (
                        <div className="text-xs text-amber-600 mt-1 font-medium">
                          ★ {customer.loyalty_points} points
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200">
            <button
              onClick={openNew}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-base font-medium"
            >
              + Add New Customer
            </button>
          </div>
        </div>

        {/* RIGHT PANE - Details or Edit */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col">
          {isEditingDetails && editing ? (
            <EditPane
              customer={editing}
              originalCustomer={originalCustomer}
              updateField={updateField}
              save={save}
              remove={remove}
              saving={saving}
              errorMsg={errorMsg}
              successMsg={successMsg}
              onCancel={() => {
                setIsEditingDetails(false);
                setEditing(null);
                setErrorMsg(null);
              }}
              isNewCustomer={!editing.id}
            />
          ) : selected ? (
            <DetailsPane customer={selected} onEdit={startEdit} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">👥</div>
                <p>Select a customer to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Details View Pane
function DetailsPane({
  customer,
  onEdit,
}: {
  customer: Customer;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h3 className="text-4xl font-bold">
            {customer.first_name} {customer.last_name}
          </h3>
          <p className="text-gray-500 mt-2 text-lg">{customer.email_address}</p>
        </div>
        <button
          onClick={onEdit}
          className="p-3 hover:bg-gray-100 rounded-lg transition"
          title="Edit"
        >
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <DetailField label="First Name" value={customer.first_name} />
            <DetailField
              label="Middle Name"
              value={customer.middle_name || "—"}
            />
            <DetailField label="Last Name" value={customer.last_name} />
            <DetailField label="Birthdate" value={customer.birthdate || "—"} />
          </div>
          <div>
            <DetailField
              label="Gender"
              value={
                customer.gender
                  ? customer.gender.charAt(0).toUpperCase() +
                    customer.gender.slice(1)
                  : "—"
              }
            />
            <DetailField label="Email" value={customer.email_address || "—"} />
            <DetailField label="Phone" value={customer.phone_number || "—"} />
            <DetailField
              label="Loyalty Points"
              value={`⭐ ${customer.loyalty_points || 0} points`}
            />
          </div>
        </div>
        <div className="mt-6">
          <DetailField label="Address" value={customer.address || "—"} />
        </div>
      </div>
    </div>
  );
}

// Details Field Component
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-5">
      <label className="text-sm text-gray-500 font-medium">{label}</label>
      <p className="text-base text-gray-900 mt-1">{value}</p>
    </div>
  );
}

// Edit Pane
function EditPane({
  customer,
  originalCustomer,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  successMsg,
  onCancel,
  isNewCustomer,
}: {
  customer: Customer;
  originalCustomer: Customer | null;
  updateField: (key: keyof Customer, value: any) => void;
  save: () => void;
  remove: () => void;
  saving: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  onCancel: () => void;
  isNewCustomer: boolean;
}) {
  // Check if there are any changes
  const hasChanges =
    isNewCustomer ||
    !originalCustomer ||
    JSON.stringify(customer) !== JSON.stringify(originalCustomer);

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-gray-200">
        <h3 className="text-4xl font-bold">
          {isNewCustomer ? "Add New Customer" : "Edit Customer"}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <Field
            label="First Name"
            value={customer.first_name}
            onChange={(v) => updateField("first_name", v)}
          />
          <Field
            label="Middle Name"
            value={customer.middle_name ?? ""}
            onChange={(v) => updateField("middle_name", v)}
          />
          <Field
            label="Last Name"
            value={customer.last_name}
            onChange={(v) => updateField("last_name", v)}
          />
          <Field
            label="Birthdate"
            type="date"
            value={customer.birthdate ?? ""}
            onChange={(v) => updateField("birthdate", v)}
          />

          <Select
            label="Gender"
            value={customer.gender ?? ""}
            onChange={(v) => updateField("gender", v || null)}
            options={[
              { value: "", label: "Select…" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />

          <Field
            label="Email Address"
            value={customer.email_address ?? ""}
            onChange={(v) => updateField("email_address", v)}
            disabled={!isNewCustomer}
          />
          <Field
            label="Phone"
            value={customer.phone_number ?? ""}
            onChange={(v) => updateField("phone_number", v)}
          />

          <div className="col-span-2">
            <Field
              label="Address"
              value={customer.address ?? ""}
              onChange={(v) => updateField("address", v)}
            />
          </div>

          {isNewCustomer && (
            <div className="col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <strong>📧 Account Creation:</strong> An invitation link will be
              sent to the email address. The customer can set their password and
              activate their account through the link.
            </div>
          )}
        </div>
      </div>

      <div className="p-8 border-t border-gray-200 flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          Cancel
        </button>

        {!isNewCustomer && (
          <button
            onClick={remove}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-base font-medium w-24"
            disabled={saving}
          >
            Delete
          </button>
        )}

        {hasChanges && (
          <button
            onClick={save}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-base font-medium w-24"
            disabled={saving}
          >
            {saving ? "Saving..." : isNewCustomer ? "Add" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

// Simple reusable input field
function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
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
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
