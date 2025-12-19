"use client";

import React from "react";
import { Customer } from "../logic/types";

type Props = {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
  customerQuery: string;
  setCustomerQuery: (s: string) => void;
  customerSuggestions: Customer[];
  pickCustomer: (c: Customer) => void;
  clearCustomer: () => void;
};

export default function PaneCustomer({
  customer,
  setCustomer,
  customerQuery,
  setCustomerQuery,
  customerSuggestions,
  pickCustomer,
  clearCustomer,
}: Props) {
  const isLoadedFromDB = !!customer?.id;
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const handleCreateCustomer = async () => {
    if (!customer?.first_name || !customer?.last_name || !customer?.phone_number) {
      setCreateError("First name, last name, and phone number are required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone_number: customer.phone_number,
          email: customer.email_address || null,
          birthdate: customer.birthdate || null,
          gender: customer.gender || null,
          address: customer.address || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setCreateError(data.error || "Failed to create customer");
        return;
      }

      // Set customer with ID from API
      setCustomer({ ...customer, id: data.customer.id });
    } catch (err) {
      setCreateError("Error creating customer. Please try again.");
      console.error("Create customer error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Details</h2>

      <div className="grid grid-cols-2 gap-4">
        {!isLoadedFromDB && (
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Search existing customer
            </label>
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Type name to search existing customers..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {customerSuggestions.length > 0 && (
              <div className="mt-2 border border-gray-300 rounded-lg shadow-lg bg-white max-h-48 overflow-auto">
                {customerSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => pickCustomer(s)}
                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-sm"
                  >
                    <div className="font-medium text-gray-900">
                      {s.first_name} {s.last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{s.phone_number}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            First Name *
          </label>
          <input
            value={customer?.first_name ?? ""}
            onChange={(e) => setCustomer({ ...customer, first_name: e.target.value } as Customer)}
            disabled={isLoadedFromDB}
            placeholder="Required"
            className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoadedFromDB ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Last Name *
          </label>
          <input
            value={customer?.last_name ?? ""}
            onChange={(e) => setCustomer({ ...customer, last_name: e.target.value } as Customer)}
            disabled={isLoadedFromDB}
            placeholder="Required"
            className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoadedFromDB ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
            }`}
          />
        </div>

        {isLoadedFromDB && (
          <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">Customer loaded. ID: {customer?.id}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Phone Number *
          </label>
          <input
            value={customer?.phone_number ?? ""}
            onChange={(e) => {
              const value = e.target.value.replace(/[^\d\s\-\+\(\)]/g, "");
              setCustomer({ ...customer, phone_number: value } as Customer);
            }}
            disabled={isLoadedFromDB}
            placeholder="Required"
            className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoadedFromDB ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={customer?.email_address ?? ""}
            onChange={(e) => setCustomer({ ...customer, email_address: e.target.value } as Customer)}
            disabled={isLoadedFromDB}
            placeholder="Optional"
            className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoadedFromDB ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
            }`}
          />
        </div>

        {createError && (
          <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-900">{createError}</p>
          </div>
        )}

        <div className="col-span-2 mt-2 flex gap-2">
          {!isLoadedFromDB && (
            <button
              onClick={handleCreateCustomer}
              disabled={isCreating || !customer?.first_name || !customer?.last_name || !customer?.phone_number}
              className="flex-1 px-4 py-4 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:bg-gray-400 transition text-base"
            >
              {isCreating ? "Creating..." : "Create Customer"}
            </button>
          )}
          <button
            onClick={() => clearCustomer()}
            className={`flex-1 px-4 py-4 rounded-lg font-semibold transition text-base ${
              isLoadedFromDB
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border-2 border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {isLoadedFromDB ? "Change Customer" : "Clear"}
          </button>
        </div>
      </div>
    </div>
  );
}
