// src/app/components/Navbar.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Helper function to check if a path is active
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + "/");
  };

  // Fetch user roles on component mount
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setUserRoles([]);
          setLoading(false);
          return;
        }

        // Fetch staff record to check is_active
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("id, is_active")
          .eq("auth_id", user.id)
          .single();

        if (staffError || !staffData || !staffData.is_active) {
          console.error("Staff not found or inactive:", staffError);
          setUserRoles([]);
          setLoading(false);
          return;
        }

        // Fetch roles via staff_roles junction table
        const { data: staffRolesData, error: rolesError } = await supabase
          .from("staff_roles")
          .select("role_id")
          .eq("staff_id", staffData.id);

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
          setUserRoles([]);
        } else {
          const roles = staffRolesData?.map((r) => r.role_id) || [];
          setUserRoles(roles);
        }
      } catch (err) {
        console.error("Error in fetchUserRoles:", err);
        setUserRoles([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch low-stock products
    const fetchLowStockCount = async () => {
      try {
        const res = await fetch("/api/manage/products/getAllProducts");
        if (res.ok) {
          const products = await res.json();
          const lowStockProducts = products.filter(
            (p: any) => parseInt(p.quantity) <= parseInt(p.reorder_level),
          );
          setLowStockCount(lowStockProducts.length);
        }
      } catch (err) {
        console.error("Error fetching low-stock count:", err);
      }
    };

    fetchUserRoles();
    fetchLowStockCount();
  }, [supabase]);

  // Placeholder navigation functions
  const goToPOS = () => router.push("/in/pos");
  const goToOrders = () => router.push("/in/orders");
  const goToBaskets = () => router.push("/in/baskets");
  const goToProducts = () => router.push("/in/manage/products");
  const goToMachines = () => router.push("/in/manage/machines");
  const goToServices = () => router.push("/in/manage/services");
  const goToIssues = () => router.push("/in/manage/issues");
  const goToStaff = () => router.push("/in/accounts/staff");
  const goToCustomer = () => router.push("/in/accounts/customers");
  const goToSettings = () => router.push("/in/settings");
  const goToAnalytics = () => router.push("/in/analytics");
  const signOut = () =>
    supabase.auth
      .signOut()
      .then(() => console.log("Signed out"))
      .then(() => router.refresh());

  // Role-based access control
  const canAccessPOS =
    userRoles.includes("admin") || userRoles.includes("cashier");
  const canAccessOrders =
    userRoles.includes("admin") ||
    userRoles.includes("attendant") ||
    userRoles.includes("cashier") ||
    userRoles.includes("rider");
  const canAccessBaskets =
    userRoles.includes("admin") ||
    userRoles.includes("attendant") ||
    userRoles.includes("cashier");
  const canAccessManage =
    userRoles.includes("admin") || userRoles.includes("attendant");
  const canAccessAccounts = userRoles.includes("admin");

  if (loading) {
    return (
      <nav className="bg-slate-900 border-b border-slate-700 shadow-lg px-6 py-4">
        <div className="text-slate-400">Loading...</div>
      </nav>
    );
  }

  return (
    <nav className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 shadow-lg px-6 py-4 flex justify-between items-center w-full m-0">
      {/* Left Navigation */}
      <div className="flex items-center space-x-6">
        {/* POS - Cashier only */}
        {canAccessPOS && (
          <button
            onClick={goToPOS}
            className={`font-medium transition-all px-3 py-2 rounded-lg relative group ${
              isActive("/in/pos")
                ? "text-blue-400"
                : "text-slate-200 hover:text-blue-400"
            }`}
          >
            POS
            <span
              className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                isActive("/in/pos")
                  ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                  : "w-0 group-hover:w-full bg-blue-500/50"
              }`}
            />
          </button>
        )}

        {/* Orders - Rider and Admin */}
        {canAccessOrders && (
          <button
            onClick={goToOrders}
            className={`font-medium transition-all px-3 py-2 rounded-lg relative group ${
              isActive("/in/orders")
                ? "text-blue-400"
                : "text-slate-200 hover:text-blue-400"
            }`}
          >
            Orders
            <span
              className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                isActive("/in/orders")
                  ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                  : "w-0 group-hover:w-full bg-blue-500/50"
              }`}
            />
          </button>
        )}

        {/* Baskets - Attendant, Cashier Attendant, and Admin */}
        {canAccessBaskets && (
          <button
            onClick={goToBaskets}
            className={`font-medium transition-all px-3 py-2 rounded-lg relative group ${
              isActive("/in/baskets")
                ? "text-blue-400"
                : "text-slate-200 hover:text-blue-400"
            }`}
          >
            Baskets
            <span
              className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                isActive("/in/baskets")
                  ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                  : "w-0 group-hover:w-full bg-blue-500/50"
              }`}
            />
          </button>
        )}

        {/* Manage Dropdown - Attendant, Cashier Attendant, and Admin */}
        {canAccessManage && (
          <div
            className="relative"
            onMouseEnter={() => setManageOpen(true)}
            onMouseLeave={() => setManageOpen(false)}
          >
            <button
              className={`font-medium transition-all px-3 py-2 rounded-lg relative group flex items-center gap-2 ${
                isActive("/in/manage")
                  ? "text-blue-400"
                  : "text-slate-200 hover:text-blue-400"
              }`}
            >
              <span>Manage</span>
              {lowStockCount > 0 && (
                <span className="bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">
                  {lowStockCount}
                </span>
              )}
              <span
                className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                  isActive("/in/manage")
                    ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                    : "w-0 group-hover:w-full bg-blue-500/50"
                }`}
              />
            </button>
            <div
              className={`absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 flex flex-col ${
                manageOpen ? "block" : "hidden"
              }`}
            >
              <button
                onClick={goToProducts}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition flex items-center justify-between"
              >
                <span>Products</span>
                {lowStockCount > 0 && (
                  <span className="bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold ml-2">
                    {lowStockCount}
                  </span>
                )}
              </button>
              {/* <button
                onClick={goToMachines}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition"
              >
                Machines
              </button> */}
              <button
                onClick={goToServices}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition"
              >
                Services
              </button>
              <button
                onClick={goToIssues}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition"
              >
                Issues
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
            <button
              className={`font-medium transition-all px-3 py-2 rounded-lg relative group ${
                isActive("/in/accounts")
                  ? "text-blue-400"
                  : "text-slate-200 hover:text-blue-400"
              }`}
            >
              Accounts
              <span
                className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                  isActive("/in/accounts")
                    ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                    : "w-0 group-hover:w-full bg-blue-500/50"
                }`}
              />
            </button>
            <div
              className={`absolute top-full left-0 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 flex flex-col ${
                accountsOpen ? "block" : "hidden"
              }`}
            >
              <button
                onClick={goToStaff}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition"
              >
                Staff
              </button>
              <button
                onClick={goToCustomer}
                className="px-4 py-2 text-left text-slate-200 hover:bg-slate-700 hover:text-blue-400 transition"
              >
                Customers
              </button>
            </div>
          </div>
        )}

        {/* Performance - Admin only
        {canAccessAccounts && (
          <button
            onClick={goToAnalytics}
            className={`font-medium transition-all px-3 py-2 rounded-lg relative group ${
              isActive("/in/analytics")
                ? "text-blue-400"
                : "text-slate-200 hover:text-blue-400"
            }`}
          >
            Performance
            <span
              className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300 ${
                isActive("/in/analytics")
                  ? "w-full bg-blue-500 shadow-lg shadow-blue-500/50"
                  : "w-0 group-hover:w-full bg-blue-500/50"
              }`}
            />
          </button>
        )} */}
      </div>

      {/* Right Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={goToSettings}
          className={`p-2 rounded-lg transition-all relative group ${
            isActive("/in/settings")
              ? "text-blue-400"
              : "text-slate-300 hover:text-blue-400"
          }`}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          <span
            className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300 ${
              isActive("/in/settings")
                ? "w-4 bg-blue-500 shadow-lg shadow-blue-500/50"
                : "w-0 group-hover:w-4 bg-blue-500/50"
            }`}
          />
        </button>
        <button
          onClick={signOut}
          className="px-4 py-2 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/10 transition font-medium"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
