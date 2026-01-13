// app/in/accounts/customers/page.tsx
"use client";

import { useEffect, useState } from "react";

// Customer type definition - matches the customers table schema
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
  // State management
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

  // Load customers on component mount
  useEffect(() => {
    load();
  }, []);

  // Debounced search filter - updates filtered list based on search query
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

  // Fetch customers from API
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

  // Initialize new customer form
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

  // Select a customer to view their details
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

  // Save customer to database via API
  async function save() {
    if (!editing) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const data = { ...editing };
    // Validate required fields - email is only required for new customers
    const requiredFields: (keyof Customer)[] = [
      "first_name",
      "last_name",
      "phone_number",
    ];

    // Email is required only for new customers
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

    // Validate phone number (PH format: 09XXXXXXXXX)
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

  // Delete customer from database
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
      if (!res.ok) {
        // Check if error is due to foreign key constraint (customer has orders)
        if (
          result.error?.includes("foreign key") ||
          result.error?.includes("violates")
        ) {
          throw new Error(
            "Cannot delete this customer because they have existing orders. Please contact support if you need to remove this customer."
          );
        }
        throw new Error(result.error || "Failed to delete customer");
      }

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

  // Update a single field in the editing customer object
  function updateField(key: keyof Customer, value: any) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  return (
    <div className="p-6 h-screen bg-gray-50 flex flex-col">
      {/* Two-column layout: left (list) and right (details/edit) */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {/* LEFT PANE - Customers List */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col min-h-0">
          <div className="p-6 border-b border-gray-200 shrink-0">
            <h2 className="text-3xl font-bold mb-4">Customers</h2>
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

          <div className="p-6 border-t border-gray-200 shrink-0">
            <button
              onClick={openNew}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-base font-medium"
            >
              + Add New Customer
            </button>
          </div>
        </div>

        {/* RIGHT PANE - Details or Edit */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col min-h-0">
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

// Details View Pane - Displays customer information in read-only format
function DetailsPane({
  customer,
  onEdit,
}: {
  customer: Customer;
  onEdit: () => void;
}) {
  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-gray-500 mt-2">Customer ID: {customer.id}</p>
          </div>
          <button
            onClick={onEdit}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            title="Edit Customer"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="text-sm text-gray-600 font-medium">Email</div>
          <div className="text-lg font-semibold text-blue-900 mt-2">
            {customer.email_address || "—"}
          </div>
        </div>
        <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="text-sm text-gray-600 font-medium">Phone</div>
          <div className="text-lg font-semibold text-green-900 mt-2">
            {customer.phone_number || "—"}
          </div>
        </div>
      </div>

      {/* Loyalty Points */}
      {customer.loyalty_points !== null && customer.loyalty_points > 0 && (
        <div className="bg-linear-to-br from-yellow-50 to-amber-100 rounded-lg p-6 border border-amber-200 mb-8">
          <div className="text-sm text-gray-600 font-medium">
            Loyalty Points
          </div>
          <div className="text-3xl font-bold text-amber-900 mt-2">
            ⭐ {customer.loyalty_points}
          </div>
        </div>
      )}

      {/* Personal Information Grid */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Personal Information
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <DetailField label="First Name" value={customer.first_name} />
          <DetailField
            label="Middle Name"
            value={customer.middle_name || "—"}
          />
          <DetailField label="Last Name" value={customer.last_name} />
          <DetailField label="Birthdate" value={customer.birthdate || "—"} />
          <DetailField
            label="Gender"
            value={
              customer.gender
                ? customer.gender.charAt(0).toUpperCase() +
                  customer.gender.slice(1)
                : "—"
            }
          />
        </div>
      </div>

      {/* Address Section */}
      {customer.address && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Address</h3>
          <p className="text-gray-700 leading-relaxed">{customer.address}</p>
        </div>
      )}
    </div>
  );
}

// Details Field Component - Reusable field display for read-only info
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-5">
      <label className="text-sm text-gray-500 font-medium">{label}</label>
      <p className="text-base text-gray-900 mt-1">{value}</p>
    </div>
  );
}

// Edit Pane - Form for creating/editing customer information
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
  // Check if there are any changes from original data
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
          />
          <PhoneField
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
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="tel"
        value={value}
        onChange={(e) => {
          // Only allow digits
          const digits = e.target.value.replace(/\D/g, "");
          // Limit to 11 digits for Philippine format
          if (digits.length <= 11) {
            onChange(digits);
          }
        }}
        maxLength={11}
        disabled={disabled}
        placeholder="09XXXXXXXXX"
        className={`border px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-gray-500 ${
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

// Simple reusable input field component for forms
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

// Simple select dropdown component for forms
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
