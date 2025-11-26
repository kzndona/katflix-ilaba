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
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Customer</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">
            Search or type name
          </label>
          <input
            type="text"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="Live search — matches will appear as you type"
            className="w-full border rounded px-3 py-3"
          />
          {customerSuggestions.length > 0 && (
            <div className="mt-2 border rounded shadow-sm bg-white max-h-44 overflow-auto">
              {customerSuggestions.map((s: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => pickCustomer(s)}
                  className="px-3 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="font-medium">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="text-xs text-gray-500">{s.phone_number}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">First name</label>
          <input
            value={customer?.first_name ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), first_name: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Middle name</label>
          <input
            value={customer?.middle_name ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), middle_name: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Last name</label>
          <input
            value={customer?.last_name ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), last_name: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Birthdate</label>
          <input
            type="date"
            value={customer?.birthdate ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), birthdate: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select
            value={customer?.gender ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), gender: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          >
            <option value="">--</option>
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={customer?.phone_number ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), phone_number: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={customer?.email_address ?? ""}
            onChange={(e) =>
              setCustomer({
                ...(customer ?? {}),
                email_address: e.target.value,
              })
            }
            className="w-full border rounded px-3 py-3"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            value={customer?.address ?? ""}
            onChange={(e) =>
              setCustomer({ ...(customer ?? {}), address: e.target.value })
            }
            className="w-full border rounded px-3 py-3"
            rows={3}
          />
        </div>

        <div className="col-span-2 mt-4 flex gap-3">
          <button
            className="px-4 py-3 rounded bg-indigo-600 text-white"
            onClick={() => {
              alert("Customer saved (mock)");
            }}
          >
            Save Customer
          </button>

          <button
            className="px-4 py-3 rounded border"
            onClick={() => {
              clearCustomer();
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
