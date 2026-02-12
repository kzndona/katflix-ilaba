"use client";

import { useEffect, useState } from "react";
import { formatToPST } from "@/src/app/utils/dateUtils";

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email_address: string | null;
  phone_number: string | null;
};

type Order = {
  id: string;
  source: string;
  customer_id: string | null;
  cashier_id: string | null;
  cashier_name?: string; // For display
  status: string;
  total_amount: number;
  order_note: string | null;
  created_at: string | null;
  completed_at: string | null;
  gcash_receipt_url?: string | null;
  handling: {
    pickup: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      notes: string | null;
      started_at?: string | null;
      completed_at?: string | null;
    };
    delivery: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      notes: string | null;
      started_at?: string | null;
      completed_at?: string | null;
    };
    payment_method?: "cash" | "gcash";
    scheduled?: boolean;
    scheduled_date?: string;
    scheduled_time?: string;
  };
  breakdown: {
    items: Array<{
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
    baskets: Array<{
      basket_number: number;
      weight: number;
      subtotal?: number;
      basket_notes: string | null;
      services: Array<{
        id: string;
        service_id: string;
        service_name: string;
        is_premium: boolean;
        multiplier: number;
        rate_per_kg: number;
        subtotal: number;
        status: "pending" | "in_progress" | "completed" | "skipped";
      }>;
      total: number;
    }>;
    summary: {
      subtotal_products: number | null;
      subtotal_services: number | null;
      staff_service_fee: number | null;
      delivery_fee: number | null;
      vat_amount: number | null;
      loyalty_discount?: number | null;
      total: number;
    };
    payment: {
      method: "cash" | "gcash";
      amount_paid: number;
      change: number;
      payment_status: "successful" | "processing" | "failed";
    };
  };
  customers: Customer | null;
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  service_logs?: Array<{
    id: string;
    basket_number: number;
    service_type: "wash" | "dry" | "spin" | "iron" | "fold";
    status: "pending" | "in_progress" | "completed" | "skipped";
    started_at: string | null;
    completed_at: string | null;
    notes: string | null;
    started_by_staff: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
    completed_by_staff: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
  }>;
};

type SortConfig = {
  key: keyof Order;
  direction: "asc" | "desc";
};

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [filteredRows, setFilteredRows] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [viewing, setViewing] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cashierFilter, setCashierFilter] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([
    "pending",
    "processing",
    "completed",
    "cancelled",
  ]);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null,
  );

  const ROWS_PER_PAGE = 10;
  const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

  // Reset auto-refresh timer when user takes an action
  const resetAutoRefresh = (prevInterval: NodeJS.Timeout | null) => {
    // Always clear the previous interval first
    if (prevInterval) {
      clearInterval(prevInterval);
    }
    const newInterval = setInterval(() => {
      load();
      setLastRefresh(new Date());
    }, AUTO_REFRESH_INTERVAL);
    setRefreshInterval(newInterval);
    return newInterval;
  };

  useEffect(() => {
    // Check URL params for pre-set filters
    const params = new URLSearchParams(window.location.search);
    const urlDateFrom = params.get("dateFrom");
    const urlDateTo = params.get("dateTo");
    const urlCashierId = params.get("cashierId");

    // Format date to local YYYY-MM-DD (not UTC)
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    setDateFrom(urlDateFrom || formatLocalDate(yesterday));
    setDateTo(urlDateTo || formatLocalDate(today));
    if (urlCashierId) {
      setCashierFilter(urlCashierId);
    }
    load();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [
    rows,
    searchQuery,
    sortConfig,
    dateFrom,
    dateTo,
    cashierFilter,
    statusFilters,
  ]);

  // Auto-refresh orders every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      load();
      setLastRefresh(new Date());
    }, AUTO_REFRESH_INTERVAL);
    setRefreshInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/orders", {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server responded ${res.status}`);
      }
      const data = await res.json();
      console.log("[Orders API Response]", data);
      setRows(data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function filterAndSort() {
    let result = rows;

    // Apply date filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((order) => {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        return orderDate && orderDate >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((order) => {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        return orderDate && orderDate <= to;
      });
    }

    // Apply status filter
    if (statusFilters.length > 0) {
      result = result.filter((order) => statusFilters.includes(order.status));
    }

    // Apply cashier filter
    if (cashierFilter) {
      result = result.filter((order) => order.cashier_id === cashierFilter);
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((order) => {
        const customerName = order.customers
          ? `${order.customers.first_name} ${order.customers.last_name}`.toLowerCase()
          : "";
        const orderId = order.id.toLowerCase();
        return customerName.includes(query) || orderId.includes(query);
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortConfig.key];
      let bVal: any = b[sortConfig.key];

      // Special handling for date fields
      if (
        sortConfig.key === "created_at" ||
        sortConfig.key === "completed_at"
      ) {
        const aTime = aVal ? new Date(aVal).getTime() : 0;
        const bTime = bVal ? new Date(bVal).getTime() : 0;
        return sortConfig.direction === "asc" ? aTime - bTime : bTime - aTime;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(String(bVal));
        return sortConfig.direction === "asc" ? cmp : -cmp;
      } else if (typeof aVal === "number") {
        const numBVal = Number(bVal);
        return sortConfig.direction === "asc" ? aVal - numBVal : numBVal - aVal;
      }
      return 0;
    });

    setFilteredRows(result);
    setCurrentPage(1);
  }

  const handleSort = (key: keyof Order) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: keyof Order }) => {
    if (sortConfig.key !== field)
      return <span className="text-gray-300">⇅</span>;
    return <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

  // Group orders by status and handling type
  const processingOrders = filteredRows.filter(
    (o) => o.status === "processing",
  );
  const pickupOrders = filteredRows.filter(
    (o) =>
      o.status !== "processing" &&
      o.handling?.pickup?.address &&
      !o.handling?.delivery?.address,
  );
  const deliveryOrders = filteredRows.filter(
    (o) =>
      o.status !== "processing" &&
      o.handling?.delivery?.address &&
      !o.handling?.pickup?.address,
  );
  const pickupAndDeliveryOrders = filteredRows.filter(
    (o) =>
      o.status !== "processing" &&
      o.handling?.pickup?.address &&
      o.handling?.delivery?.address,
  );
  const otherOrders = filteredRows.filter(
    (o) =>
      o.status !== "processing" &&
      !o.handling?.pickup?.address &&
      !o.handling?.delivery?.address,
  );

  // Combine all grouped orders for pagination
  // NOTE: This maintains the sort order from filteredRows
  const groupedOrders = filteredRows;

  const totalPages = Math.ceil(groupedOrders.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const paginatedRows = groupedOrders.slice(startIdx, endIdx);

  const getStatusColor = (status: string) =>
    ({
      pending: "bg-gray-100 text-gray-700",
      processing: "bg-blue-100 text-blue-700",
      "for_pick-up": "bg-yellow-100 text-yellow-700",
      for_delivery: "bg-violet-100 text-violet-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    })[status] || "bg-gray-100 text-gray-700";

  const getStatusLabel = (status: string) =>
    ({
      pending: "Pending",
      processing: "Processing",
      completed: "Completed",
      cancelled: "Cancelled",
    })[status] || status;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {groupedOrders.length} order
              {groupedOrders.length !== 1 ? "s" : ""} found
              {groupedOrders.length > ROWS_PER_PAGE && (
                <>
                  {" "}
                  • Page {currentPage} of {totalPages}
                </>
              )}
              {lastRefresh && (
                <span className="ml-2 text-gray-400">
                  • Auto-refreshing (Last: {lastRefresh.toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Search Order ID or Customer
            </label>
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filters */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Status
            </label>
            <div className="flex gap-1 items-stretch">
              {["pending", "processing", "completed", "cancelled"].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilters((prev) =>
                        prev.includes(status)
                          ? prev.filter((s) => s !== status)
                          : [...prev, status],
                      );
                    }}
                    className={`px-3 py-2 rounded text-xs font-medium transition flex-1 border ${
                      statusFilters.includes(status)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300 border-gray-300"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="text-red-800 text-xs font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading orders...
            </div>
          ) : paginatedRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {groupedOrders.length === 0
                ? "No orders found in the selected date range."
                : "No results match your search."}
            </div>
          ) : (
            <>
              {/* Table Wrapper with Horizontal Scroll */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() =>
                            handleSort("total_amount" as keyof Order)
                          }
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Customer <SortIcon field="total_amount" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-sm text-gray-900">
                        Order ID
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-sm text-gray-900">
                        Phone
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("status" as keyof Order)}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Status <SortIcon field="status" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() => handleSort("source" as keyof Order)}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Source <SortIcon field="source" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() =>
                            handleSort("total_amount" as keyof Order)
                          }
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Total <SortIcon field="total_amount" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button
                          onClick={() =>
                            handleSort("created_at" as keyof Order)
                          }
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Created <SortIcon field="created_at" />
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-sm text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((order) => {
                      const customerName = order.customers
                        ? `${order.customers.first_name} ${order.customers.last_name}`
                        : "Unknown";

                      return (
                        <tr
                          key={order.id}
                          className="border-b border-gray-200 hover:bg-blue-50 transition"
                        >
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {customerName}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                            {order.id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {order.customers?.phone_number || "—"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                order.status,
                              )}`}
                            >
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                            {order.source}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-green-700">
                            ₱{order.total_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {formatToPST(order.created_at)}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setViewing(order)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* View Modal - Centered */}
      {viewing && (
        <ViewModal
          order={viewing}
          onClose={() => {
            setViewing(null);
            resetAutoRefresh(refreshInterval);
          }}
          onActionTaken={() => resetAutoRefresh(refreshInterval)}
        />
      )}
    </div>
  );
}

function ViewModal({
  order,
  onClose,
  onActionTaken,
}: {
  order: Order;
  onClose: () => void;
  onActionTaken: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(false);

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error || `Failed to cancel order (${res.status})`,
        );
      }

      setCancelSuccess(true);
      setShowCancelConfirm(false);
      onActionTaken();

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setCancelError(message);
      console.error("Cancel order error:", err);
    } finally {
      setCancelling(false);
    }
  };

  // Log order details for debugging
  console.log("[ViewModal] Displaying order:", {
    id: order.id,
    customer: order.customers?.first_name,
    baskets: order.breakdown?.baskets?.length,
    basketServices: order.breakdown?.baskets?.[0]?.services,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Modal Centered */}
      <div
        className="bg-white shadow-2xl rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Compact & Modern */}
        <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-start shrink-0">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900 mb-1">
              {order.customers
                ? `${order.customers.first_name} ${order.customers.last_name}`
                : "Unknown Customer"}
            </h1>
            <p className="text-sm text-gray-500 font-mono">
              Order #{order.id.slice(0, 8)} • {order.source.toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content - Multi-column layout */}
        <div className="flex-1 overflow-y-auto">
          {/* TOP SECTION: Status & Total Amount (Large & Bold) */}
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-6">
              {/* Status */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">
                  Status
                </p>
                <p className="text-2xl font-black text-gray-900 capitalize">
                  {order.status.replace(/_/g, " ")}
                </p>
              </div>
              {/* Total Amount - MOST PROMINENT */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">
                  Total Amount
                </p>
                <p className="text-3xl font-black text-green-700">
                  ₱{order.total_amount.toFixed(2)}
                </p>
              </div>
              {/* Created Date */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">
                  Created
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(order.created_at || "").toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(order.created_at || "").toLocaleTimeString(
                    "en-US",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION: Contact & Fulfillment Info */}
          <div className="px-8 py-6 space-y-6 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-6">
              {/* Contact */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Contact
                </p>
                <div className="space-y-2">
                  {order.customers?.phone_number && (
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        📱 {order.customers.phone_number}
                      </p>
                    </div>
                  )}
                  {order.customers?.email_address && (
                    <div>
                      <p className="text-sm text-gray-600 break-all">
                        {order.customers.email_address}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fulfillment - Pickup */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Pickup
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {order.handling?.pickup?.address?.toLowerCase() === "store"
                    ? "🏪 In-Store"
                    : order.handling?.pickup?.address || "In-Store"}
                </p>
                {order.handling?.pickup?.started_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Started: {formatToPST(order.handling.pickup.started_at)}
                  </p>
                )}
                {order.handling?.pickup?.completed_at && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Completed: {formatToPST(order.handling.pickup.completed_at)}
                  </p>
                )}
              </div>

              {/* Fulfillment - Delivery */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Delivery
                </p>
                <p className="text-sm font-medium text-gray-900 break-words">
                  {order.handling?.delivery?.address?.toLowerCase() ===
                    "store" || !order.handling?.delivery?.address
                    ? "🏪 In-Store"
                    : `🚚 ${order.handling.delivery.address.substring(0, 40)}${order.handling.delivery.address.length > 40 ? "..." : ""}`}
                </p>
                {order.handling?.delivery?.started_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Started: {formatToPST(order.handling.delivery.started_at)}
                  </p>
                )}
                {order.handling?.delivery?.completed_at && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Completed:{" "}
                    {formatToPST(order.handling.delivery.completed_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Scheduling - If Present (Blue Highlight) */}
            {order.handling?.scheduled && order.handling?.scheduled_date && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold mb-1">
                      📅 Scheduled Date
                    </p>
                    <p className="text-lg font-bold text-blue-900">
                      {new Date(
                        order.handling.scheduled_date,
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold mb-1">
                      ⏰ Scheduled Time
                    </p>
                    <p className="text-lg font-bold text-blue-900">
                      {order.handling.scheduled_time || "TBD"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Information */}
            {order.handling && (
              <div className="grid grid-cols-2 gap-4">
                {order.handling.payment_method && (
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">
                      Payment Method
                    </p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {order.handling.payment_method}
                    </p>
                  </div>
                )}
                {order.breakdown?.payment?.amount_paid !== null &&
                  order.breakdown?.payment?.amount_paid !== undefined && (
                    <div>
                      <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">
                        Amount Paid
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        ₱
                        {(
                          order.breakdown.payment.amount_paid as number
                        ).toFixed(2)}
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* BOTTOM SECTION: Pricing & Items (Condensed) */}
          <div className="px-8 py-6 space-y-6">
            {/* Pricing Summary - Full Breakdown */}
            {order.breakdown?.summary && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Pricing Breakdown
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  {order.breakdown.summary.subtotal_products !== null &&
                    order.breakdown.summary.subtotal_products !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Products:</span>
                        <span className="font-medium">
                          ₱
                          {(
                            order.breakdown.summary.subtotal_products as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {order.breakdown.summary.subtotal_services !== null &&
                    order.breakdown.summary.subtotal_services !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Services:</span>
                        <span className="font-medium">
                          ₱
                          {(
                            order.breakdown.summary.subtotal_services as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {order.breakdown.summary.staff_service_fee !== null &&
                    order.breakdown.summary.staff_service_fee !== undefined &&
                    (order.breakdown.summary.staff_service_fee as number) >
                      0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Staff Service Fee:
                        </span>
                        <span className="font-medium">
                          ₱
                          {(
                            order.breakdown.summary.staff_service_fee as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {order.breakdown.summary.delivery_fee !== null &&
                    order.breakdown.summary.delivery_fee !== undefined &&
                    (order.breakdown.summary.delivery_fee as number) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery Fee:</span>
                        <span className="font-medium">
                          ₱
                          {(
                            order.breakdown.summary.delivery_fee as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {order.breakdown.summary.vat_amount !== null &&
                    order.breakdown.summary.vat_amount !== undefined && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>VAT (12% inclusive):</span>
                        <span>
                          ₱
                          {(
                            order.breakdown.summary.vat_amount as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {order.breakdown.summary.loyalty_discount !== null &&
                    order.breakdown.summary.loyalty_discount !== undefined &&
                    (order.breakdown.summary.loyalty_discount as number) >
                      0 && (
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>Loyalty Discount:</span>
                        <span>
                          -₱
                          {(
                            order.breakdown.summary.loyalty_discount as number
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  <div className="flex justify-between pt-2 border-t border-gray-300 font-semibold">
                    <span className="text-gray-700">Total:</span>
                    <span className="text-gray-900">
                      ₱{order.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Products */}
            {order.breakdown?.items && order.breakdown.items.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Products ({order.breakdown.items.length})
                </p>
                <div className="space-y-2">
                  {order.breakdown.items.map((item, idx) => {
                    const quantity = item.quantity || 0;
                    const unitPrice = item.unit_price || 0;
                    const subtotal = item.subtotal ?? quantity * unitPrice;

                    return (
                      <div
                        key={item.id || `item-${idx}`}
                        className="flex justify-between text-sm p-2 rounded bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.product_name || "Unknown Product"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {quantity} × ₱{(unitPrice as number).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-medium text-gray-900">
                          ₱{(subtotal as number).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Baskets */}
            {order.breakdown?.baskets && order.breakdown.baskets.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Baskets ({order.breakdown.baskets.length})
                </p>
                <div className="space-y-3">
                  {order.breakdown.baskets.map((basket, idx) => (
                    <BasketCard
                      key={idx}
                      basket={basket}
                      breakdownSummary={order.breakdown.summary}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Service Timeline */}
            {order.service_logs && order.service_logs.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  Service Timeline
                </p>
                <div className="space-y-2">
                  {/* Group logs by basket */}
                  {Array.from(
                    new Set(order.service_logs.map((log) => log.basket_number)),
                  )
                    .sort((a, b) => a - b)
                    .map((basketNum) => {
                      const basketLogs = order.service_logs!.filter(
                        (log) => log.basket_number === basketNum,
                      );
                      return (
                        <div
                          key={basketNum}
                          className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                        >
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            Basket #{basketNum}
                          </p>
                          <div className="space-y-2 pl-3 border-l-2 border-blue-300">
                            {basketLogs.map((log, idx) => (
                              <div key={log.id} className="text-xs">
                                <div className="flex items-start gap-2">
                                  <div className="mt-1">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full -ml-3.5 ${
                                        log.status === "completed"
                                          ? "bg-green-500"
                                          : log.status === "in_progress"
                                            ? "bg-blue-500"
                                            : log.status === "skipped"
                                              ? "bg-gray-400"
                                              : "bg-yellow-500"
                                      }`}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium text-gray-900 capitalize">
                                        {log.service_type}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          log.status === "completed"
                                            ? "bg-green-100 text-green-800"
                                            : log.status === "in_progress"
                                              ? "bg-blue-100 text-blue-800"
                                              : log.status === "skipped"
                                                ? "bg-gray-100 text-gray-800"
                                                : "bg-yellow-100 text-yellow-800"
                                        }`}
                                      >
                                        {log.status.replace("_", " ")}
                                      </span>
                                    </div>

                                    {/* Started Info */}
                                    {log.started_at && (
                                      <div className="mt-1 text-gray-600">
                                        <span>Started: </span>
                                        <span className="text-gray-900 font-medium">
                                          {new Date(
                                            log.started_at,
                                          ).toLocaleString()}
                                        </span>
                                        {log.started_by_staff && (
                                          <span className="text-gray-500">
                                            {" "}
                                            by{" "}
                                            <span className="text-gray-900">
                                              {log.started_by_staff.first_name}{" "}
                                              {log.started_by_staff.last_name}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Completed Info */}
                                    {log.completed_at && (
                                      <div className="mt-1 text-gray-600">
                                        <span>Completed: </span>
                                        <span className="text-gray-900 font-medium">
                                          {new Date(
                                            log.completed_at,
                                          ).toLocaleString()}
                                        </span>
                                        {log.completed_by_staff && (
                                          <span className="text-gray-500">
                                            {" "}
                                            by{" "}
                                            <span className="text-gray-900">
                                              {
                                                log.completed_by_staff
                                                  .first_name
                                              }{" "}
                                              {log.completed_by_staff.last_name}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Duration */}
                                    {log.started_at && log.completed_at && (
                                      <div className="mt-1 text-gray-600 text-xs">
                                        <span>Duration: </span>
                                        <span className="text-gray-900 font-medium">
                                          {(() => {
                                            const start = new Date(
                                              log.started_at,
                                            );
                                            const end = new Date(
                                              log.completed_at,
                                            );
                                            const diffMs =
                                              end.getTime() - start.getTime();
                                            const diffMins = Math.round(
                                              diffMs / 60000,
                                            );
                                            const hours = Math.floor(
                                              diffMins / 60,
                                            );
                                            const mins = diffMins % 60;
                                            return hours > 0
                                              ? `${hours}h ${mins}m`
                                              : `${mins}m`;
                                          })()}
                                        </span>
                                      </div>
                                    )}

                                    {/* Notes */}
                                    {log.notes && (
                                      <div className="mt-1 text-gray-600 text-xs italic">
                                        {log.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between gap-2 shrink-0">
          <div className="flex-1">
            {cancelError && (
              <div className="text-red-600 text-xs font-medium">
                {cancelError}
              </div>
            )}
            {cancelSuccess && (
              <div className="text-green-600 text-xs font-medium">
                ✓ Order cancelled successfully
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            {showCancelConfirm ? (
              <>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </>
            ) : (
              <>
                {order.status !== "cancelled" &&
                  order.status !== "completed" && (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancelling || cancelSuccess}
                      className="px-4 py-2 border border-red-300 rounded-lg text-red-700 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel Order
                    </button>
                  )}
                <button
                  onClick={onClose}
                  disabled={cancelling}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  order,
  onClose,
  onActionTaken,
}: {
  order: Order;
  onClose: () => void;
  onActionTaken: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editedHandling, setEditedHandling] = useState(order.handling || {});

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          handling: editedHandling,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error || `Failed to update order (${res.status})`,
        );
      }

      setSuccessMsg("✓ Order updated successfully");
      onActionTaken();

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      console.error("Save order error:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateHandling = (key: string, value: string) => {
    setEditedHandling((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updatePickupAddress = (value: string) => {
    setEditedHandling((prev) => ({
      ...prev,
      pickup: {
        ...prev.pickup,
        address: value,
      },
    }));
  };

  const updateDeliveryAddress = (value: string) => {
    setEditedHandling((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        address: value,
      },
    }));
  };

  const customerName = order.customers
    ? `${order.customers.first_name} ${order.customers.last_name}`
    : "Unknown";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Modal Centered */}
      <div
        className="bg-white shadow-2xl rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-amber-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Order</h2>
            <p className="text-xs text-gray-500 mt-1">
              Order {order.id.slice(0, 8)}... • {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold transition disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Pickup Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pickup Address
            </label>
            <textarea
              value={editedHandling.pickup?.address || ""}
              onChange={(e) => updatePickupAddress(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 text-sm resize-none h-20"
              placeholder="Enter pickup address..."
            />
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Delivery Address
            </label>
            <textarea
              value={editedHandling.delivery?.address || ""}
              onChange={(e) => updateDeliveryAddress(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 text-sm resize-none h-20"
              placeholder="Enter delivery address..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between gap-2 shrink-0">
          <div className="flex-1">
            {errorMsg && (
              <div className="text-red-600 text-xs font-medium">{errorMsg}</div>
            )}
            {successMsg && (
              <div className="text-green-600 text-xs font-medium">
                {successMsg}
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function BasketCard({
  basket,
  breakdownSummary,
}: {
  basket: Order["breakdown"]["baskets"][0];
  breakdownSummary?: Order["breakdown"]["summary"];
}) {
  const basketNumber = basket?.basket_number || 0;
  const total = basket?.subtotal || basket?.total || 0;

  console.log("[BasketCard] Raw basket object:", {
    basket_number: basket?.basket_number,
    subtotal: basket?.subtotal,
    total: basket?.total,
    resolvedTotal: total,
  });

  // Extract services from the services object with pricing snapshots
  // Services are stored as: { wash: "basic", dry: "basic", wash_pricing: {...}, dry_pricing: {...}, ... }
  const servicesObj = basket?.services || {};

  console.log("[BasketCard] Services object keys:", Object.keys(servicesObj));

  // Find all *_pricing entries which contain the service snapshots
  const allPricingKeys = Object.entries(servicesObj)
    .filter(([key]) => key.endsWith("_pricing"))
    .map(([key, pricingData]: [string, any]) => ({
      key,
      serviceType: key.replace("_pricing", ""), // e.g., "wash_pricing" -> "wash"
      ...pricingData,
    }));

  console.log(
    "[BasketCard] All pricing snapshots found:",
    allPricingKeys.map((p) => ({
      serviceType: p.serviceType,
      base_price: p.base_price,
      total_price: p.total_price,
    })),
  );

  const servicePricings = allPricingKeys
    .filter((pricing) => {
      // NEVER show staff_service_pricing in basket card
      // Staff Service is an order-level fee, not a basket-level service
      if (pricing.serviceType === "staff_service") {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Define service order: Wash, Spin, Dry, Additional Dry, Iron
      const serviceOrder: Record<string, number> = {
        wash: 1,
        spin: 2,
        dry: 3,
        additional_dry_time: 4,
        iron: 5,
        staff_service: 6,
        fold: 7,
      };
      const orderA = serviceOrder[a.serviceType] || 99;
      const orderB = serviceOrder[b.serviceType] || 99;
      return orderA - orderB;
    });

  console.log(
    "[BasketCard] Filtered servicePricings:",
    servicePricings.map((p) => ({
      serviceType: p.serviceType,
      base_price: p.base_price,
      total_price: p.total_price,
    })),
  );

  // For services without pricing info, extract from the base service keys
  const baseServices = Object.entries(servicesObj)
    .filter(
      ([key, value]) =>
        !key.endsWith("_pricing") &&
        typeof value === "string" &&
        value !== "off" &&
        value !== false,
    )
    .map(([key, value]) => ({
      key,
      serviceType: key,
      serviceName: key.charAt(0).toUpperCase() + key.slice(1),
      value, // "basic", "premium", etc.
    }))
    .filter(
      (s) =>
        ![
          "wash_cycles",
          "plastic_bags",
          "iron_weight_kg",
          "fold",
          "spin",
          "additional_dry_time_minutes",
        ].includes(s.key),
    );

  // Calculate subtotal from pricing snapshots
  const servicesSubtotal = servicePricings.reduce((sum, service) => {
    // For additional_dry_time, use total_price; for others use base_price
    let price =
      service.serviceType === "additional_dry_time"
        ? service.total_price || 0
        : service.base_price || 0;

    // For iron service, multiply by iron_weight_kg
    if (
      service.serviceType === "iron" &&
      (servicesObj as any)?.iron_weight_kg
    ) {
      const weight = (servicesObj as any).iron_weight_kg as number;
      price = price * weight;
    }

    console.log(`[BasketCard] Service ${service.serviceType}: price=${price}`);
    return sum + price;
  }, 0);

  console.log("[BasketCard] Calculated servicesSubtotal:", servicesSubtotal);

  // CRITICAL: Prioritize calculated subtotal from pricing snapshots over stored total
  // The stored "total" field may be incorrect; trust the pricing snapshots instead
  const displayTotal =
    servicePricings.length > 0 && servicesSubtotal > 0
      ? servicesSubtotal
      : total > 0
        ? total
        : 0;

  console.log("[BasketCard] Final displayTotal:", {
    storedTotal: total,
    calculatedServicesSubtotal: servicesSubtotal,
    displayTotal,
    source:
      servicePricings.length > 0 && servicesSubtotal > 0
        ? "pricing_snapshots"
        : "stored_total",
  });

  // Check if basket has heavy fabrics
  const hasHeavyFabrics = (servicesObj as any)?.heavy_fabrics === true;

  return (
    <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h5 className="font-semibold text-sm">Basket #{basketNumber}</h5>
            {hasHeavyFabrics && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                👖 Heavy Fabrics
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">
            ₱{(displayTotal as number).toFixed(2)}
          </div>
        </div>
      </div>

      {basket.basket_notes && (
        <p className="text-xs text-gray-700 mb-2 italic">
          "{basket.basket_notes}"
        </p>
      )}

      {servicePricings.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-50">
          <div className="space-y-1">
            {servicePricings.map((pricing) => {
              // Handle additional_dry_time_pricing specially
              if (pricing.serviceType === "additional_dry_time") {
                return (
                  <div
                    key={pricing.key}
                    className="text-xs text-gray-700 grid grid-cols-[1fr_80px] gap-2"
                  >
                    <span className="font-medium truncate">
                      Additional Dry ({pricing.total_minutes}m)
                    </span>
                    <span className="font-medium text-right">
                      ₱{(pricing.total_price as number).toFixed(2)}
                    </span>
                  </div>
                );
              }

              const serviceName = pricing.name || pricing.serviceType;
              const basePrice = pricing.base_price || 0;
              const tier = pricing.tier ? ` (${pricing.tier})` : "";

              // For iron service, multiply by iron_weight_kg
              let displayPrice = basePrice;
              let displayLabel = serviceName + tier;

              if (
                pricing.serviceType === "iron" &&
                (servicesObj as any)?.iron_weight_kg
              ) {
                const weight = (servicesObj as any).iron_weight_kg as number;
                displayPrice = basePrice * weight;
                displayLabel = `${serviceName} (${weight}kg)`;
              }

              return (
                <div
                  key={pricing.key}
                  className="text-xs text-gray-700 grid grid-cols-[1fr_80px] gap-2"
                >
                  <span className="font-medium truncate">{displayLabel}</span>
                  <span className="font-medium text-right">
                    ₱{(displayPrice as number).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {servicePricings.length === 0 &&
        breakdownSummary?.subtotal_services &&
        (breakdownSummary.subtotal_services as number) > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-50">
            <p className="text-xs text-gray-500 italic">
              Services included in basket (₱
              {(breakdownSummary.subtotal_services as number).toFixed(2)} total)
            </p>
          </div>
        )}
    </div>
  );
}

function EditPane({
  order,
  updateField,
  save,
  remove,
  saving,
  errorMsg,
  successMsg,
  onCancel,
}: {
  order: Order;
  updateField: (key: keyof Order, value: any) => void;
  save: () => void;
  remove: () => void;
  saving: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-gray-200">
        <h3 className="text-4xl font-bold">Edit Order</h3>
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

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Select
              label="Source"
              value={order.source}
              onChange={(v) => updateField("source", v)}
              options={[
                { value: "pos", label: "POS" },
                { value: "mobile", label: "Mobile" },
              ]}
            />

            <Select
              label="Status"
              value={order.status}
              onChange={(v) => updateField("status", v)}
              options={[
                { value: "pending", label: "Pending" },
                { value: "for_pick-up", label: "For Pick-up" },
                { value: "processing", label: "Processing" },
                { value: "for_delivery", label: "For Delivery" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />

            <Field
              label="Total Amount"
              value={order.total_amount.toString()}
              onChange={(v) => updateField("total_amount", parseFloat(v))}
              type="number"
            />

            <Field
              label="Order Note"
              value={order.order_note ?? ""}
              onChange={(v) => updateField("order_note", v)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Field
              label="Completed At"
              value={order.completed_at ?? ""}
              onChange={(v) => updateField("completed_at", v)}
              type="datetime-local"
            />
          </div>
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

        <button
          onClick={remove}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          Delete
        </button>

        <button
          onClick={save}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-base font-medium w-24"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

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
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

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
