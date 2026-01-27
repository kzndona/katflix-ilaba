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
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [originalCustomer, setOriginalCustomer] = useState<Customer | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

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
          const email = (customer.email_address || "").toLowerCase();
          const phone = (customer.phone_number || "").toLowerCase();
          return (
            fullName.includes(query) ||
            email.includes(query) ||
            phone.includes(query)
          );
        });
        setFilteredRows(filtered);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, rows]);

  // Fetch customers from API
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/getCustomersTable");
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setRows(data);
      setFilteredRows(data);
    } catch (error) {
      console.error("Failed to load customers:", error);
      setErrorMsg("Failed to load customers");
    } finally {
      setLoading(false);
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
    setModalMode("edit");
    setErrorMsg(null);
  }

  // Open customer in view mode
  function openView(customer: Customer) {
    setEditing(customer);
    setOriginalCustomer(customer);
    setModalMode("view");
  }

  // Switch to edit mode
  function startEdit() {
    if (!editing) return;
    setEditing({ ...editing });
    setOriginalCustomer({ ...editing });
    setModalMode("edit");
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
            "Cannot delete this customer because they have existing orders. Please contact support if you need to remove this customer.",
          );
        }
        throw new Error(result.error || "Failed to delete customer");
      }

      setSuccessMsg("Customer deleted successfully");
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

  // Update a single field in the editing customer object
  function updateField(key: keyof Customer, value: any) {
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
              Customers Management
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {filteredRows.length} customer
              {filteredRows.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            + Add New Customer
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
            <div className="text-green-800 text-xs font-medium">
              {successMsg}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading customers...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {rows.length === 0
                ? "No customers yet. Create one to get started!"
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
                      Loyalty Points
                    </th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {customer.first_name} {customer.last_name}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {customer.email_address || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {customer.phone_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {customer.loyalty_points && customer.loyalty_points > 0
                          ? `⭐ ${customer.loyalty_points}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openView(customer)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-xs mr-3"
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
        <CustomerModal
          customer={editing}
          originalCustomer={originalCustomer}
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
          isNewCustomer={!editing.id}
        />
      )}
    </div>
  );
}

// Customer Modal - Centered Rectangle Modal
function CustomerModal({
  customer,
  originalCustomer,
  mode,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  successMsg,
  onCancel,
  onEdit,
  isNewCustomer,
}: {
  customer: Customer;
  originalCustomer: Customer | null;
  mode: "view" | "edit";
  updateField: (key: keyof Customer, value: any) => void;
  save: () => void;
  remove: () => void;
  saving: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  onCancel: () => void;
  onEdit: () => void;
  isNewCustomer: boolean;
}) {
  const hasChanges =
    isNewCustomer ||
    !originalCustomer ||
    JSON.stringify(customer) !== JSON.stringify(originalCustomer);

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
              {customer.first_name} {customer.last_name}
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
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  Email
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {customer.email_address || "—"}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  Phone
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {customer.phone_number || "—"}
                </div>
              </div>
            </div>

            {/* Loyalty Points */}
            {customer.loyalty_points !== null &&
              customer.loyalty_points > 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-6">
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Loyalty Points
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ⭐ {customer.loyalty_points}
                  </div>
                </div>
              )}

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
                  <div className="text-gray-900 mt-1">
                    {customer.first_name}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Middle Name
                  </div>
                  <div className="text-gray-900 mt-1">
                    {customer.middle_name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Last Name
                  </div>
                  <div className="text-gray-900 mt-1">{customer.last_name}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Birthdate
                  </div>
                  <div className="text-gray-900 mt-1">
                    {customer.birthdate || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">
                    Gender
                  </div>
                  <div className="text-gray-900 mt-1">
                    {customer.gender
                      ? customer.gender.charAt(0).toUpperCase() +
                        customer.gender.slice(1)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            {customer.address && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Address
                </h3>
                <p className="text-sm text-gray-700">{customer.address}</p>
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
            {isNewCustomer ? "Add New Customer" : "Edit Customer"}
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
                value={customer.first_name}
                onChange={(v) => updateField("first_name", v)}
              />
              <Field
                label="Middle Name"
                value={customer.middle_name ?? ""}
                onChange={(v) => updateField("middle_name", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

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

            <PhoneField
              label="Phone"
              value={customer.phone_number ?? ""}
              onChange={(v) => updateField("phone_number", v)}
            />

            <Field
              label="Email Address"
              value={customer.email_address ?? ""}
              onChange={(v) => updateField("email_address", v)}
            />

            <Field
              label="Address"
              value={customer.address ?? ""}
              onChange={(v) => updateField("address", v)}
            />

            {isNewCustomer && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <strong>📧 Account Creation:</strong> An invitation link will be
                sent to the email address.
              </div>
            )}
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
          {!isNewCustomer && (
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
              {saving ? "Saving..." : isNewCustomer ? "Add" : "Save"}
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

// Simple reusable input field component for forms
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
