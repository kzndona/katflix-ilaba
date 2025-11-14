// src/app/components/Navbar.tsx
"use client";

import { useState } from "react";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const supabase = createClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);

  // Placeholder navigation functions
  const goToPOS = () => router.push("/in/pos");
  const goToOrders = () => router.push("/in/orders");
  const goToInventory = () => router.push("/in/manage/inventory");
  const goToMachines = () => router.push("/in/manage/machines");
  const goToServices = () => router.push("/in/manage/services");
  const goToStaff = () => router.push("/in/accounts/staff");
  const goToCustomer = () => router.push("/in/accounts/customer");
  const signOut = () =>
    supabase.auth
      .signOut()
      .then(() => console.log("Signed out"))
      .then(() => router.refresh());

  return (
    <nav className="bg-blue-50 shadow px-6 py-4 flex justify-between items-center">
      {/* Left Navigation */}
      <div className="flex items-center space-x-6">
        <button
          onClick={goToPOS}
          className="text-gray-700 font-medium hover:text-blue-600"
        >
          POS
        </button>

        <button
          onClick={goToOrders}
          className="text-gray-700 font-medium hover:text-blue-600"
        >
          Orders
        </button>

        {/* Manage Dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setManageOpen(true)}
          onMouseLeave={() => setManageOpen(false)}
        >
          <button className="text-gray-700 font-medium hover:text-blue-600">
            Manage
          </button>
          <div
            className={`absolute top-full left-0 w-40 bg-white border rounded shadow-lg z-10 flex flex-col ${
              manageOpen ? "block" : "hidden"
            }`}
          >
            <button
              onClick={goToInventory}
              className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              Inventory
            </button>
            <button
              onClick={goToMachines}
              className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              Machines
            </button>
            <button
              onClick={goToServices}
              className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              Services
            </button>
          </div>
        </div>

        {/* Accounts Dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setAccountsOpen(true)}
          onMouseLeave={() => setAccountsOpen(false)}
        >
          <button className="text-gray-700 font-medium hover:text-blue-600">
            Accounts
          </button>
          <div
            className={`absolute top-full left-0 w-40 bg-white border rounded shadow-lg z-10 flex flex-col ${
              accountsOpen ? "block" : "hidden"
            }`}
          >
            <button
              onClick={goToStaff}
              className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              Staff
            </button>
            <button
              onClick={goToCustomer}
              className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              Customer
            </button>
          </div>
        </div>
      </div>

      {/* Right Navigation */}
      <div>
        <button
          onClick={signOut}
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-white"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
