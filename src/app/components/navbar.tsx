// src/app/components/Navbar.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const supabase = createClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role on component mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setUserRole(null);
          setLoading(false);
          return;
        }

        // Fetch staff record to get role
        const { data, error } = await supabase
          .from("staff")
          .select("role")
          .eq("auth_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
        } else {
          setUserRole(data?.role || null);
        }
      } catch (err) {
        console.error("Error in fetchUserRole:", err);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [supabase]);

  // Placeholder navigation functions
  const goToPOS = () => router.push("/in/pos");
  const goToOrders = () => router.push("/in/orders");
  const goToBaskets = () => router.push("/in/baskets");
  const goToProducts = () => router.push("/in/manage/products");
  const goToMachines = () => router.push("/in/manage/machines");
  const goToServices = () => router.push("/in/manage/services");
  const goToStaff = () => router.push("/in/accounts/staff");
  const goToCustomer = () => router.push("/in/accounts/customers");
  const goToSettings = () => router.push("/in/settings");
  const signOut = () =>
    supabase.auth
      .signOut()
      .then(() => console.log("Signed out"))
      .then(() => router.refresh());

  // Role-based access control
  const canAccessPOS =
    userRole === "cashier" ||
    userRole === "cashier_attendant" ||
    userRole === "admin";
  const canAccessOrders =
    userRole === "rider" ||
    userRole === "attendant" ||
    userRole === "cashier_attendant" ||
    userRole === "admin";
  const canAccessBaskets =
    userRole === "attendant" ||
    userRole === "cashier_attendant" ||
    userRole === "admin";
  const canAccessManage =
    userRole === "attendant" ||
    userRole === "cashier_attendant" ||
    userRole === "admin";
  const canAccessAccounts = userRole === "admin";

  if (loading) {
    return (
      <nav className="bg-blue-50 shadow px-6 py-4">
        <div className="text-gray-600">Loading...</div>
      </nav>
    );
  }

  return (
    <nav className="bg-blue-50 shadow px-6 py-4 flex justify-between items-center">
      {/* Left Navigation */}
      <div className="flex items-center space-x-6">
        {/* POS - Cashier only */}
        {canAccessPOS && (
          <button
            onClick={goToPOS}
            className="text-gray-700 font-medium hover:text-blue-600"
          >
            POS
          </button>
        )}

        {/* Orders - Rider and Admin */}
        {canAccessOrders && (
          <button
            onClick={goToOrders}
            className="text-gray-700 font-medium hover:text-blue-600"
          >
            Orders
          </button>
        )}

        {/* Baskets - Attendant, Cashier Attendant, and Admin */}
        {canAccessBaskets && (
          <button
            onClick={goToBaskets}
            className="text-gray-700 font-medium hover:text-blue-600"
          >
            Baskets
          </button>
        )}

        {/* Manage Dropdown - Attendant, Cashier Attendant, and Admin */}
        {canAccessManage && (
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
                onClick={goToProducts}
                className="px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
              >
                Products
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
        )}

        {/* Accounts Dropdown - Admin only */}
        {canAccessAccounts && (
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
                Customers
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Navigation */}
      <div>
        <button
          onClick={goToSettings}
          className="p-2 hover:bg-gray-200 rounded-lg transition mr-3"
          title="Settings"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
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
