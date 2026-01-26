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
  status: string;
  total_amount: number;
  order_note: string | null;
  created_at: string | null;
  completed_at: string | null;
  handling: {
    pickup: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      notes: string | null;
    };
    delivery: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      notes: string | null;
    };
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
      handling: number | null;
      service_fee: number | null;
      grand_total: number;
    };
    payment: {
      method: "cash" | "gcash";
      amount_paid: number;
      change: number;
      payment_status: "successful" | "processing" | "failed";
    };
  };
  customers: Customer | null;
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

  const ROWS_PER_PAGE = 10;

  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    setDateFrom(yesterday.toISOString().split("T")[0]);
    setDateTo(today.toISOString().split("T")[0]);
    load();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [rows, searchQuery, sortConfig, dateFrom, dateTo]);

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

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((order) => {
        const customerName = order.customers
          ? `${order.customers.first_name} ${order.customers.last_name}`.toLowerCase()
          : "";
        return customerName.includes(query);
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortConfig.key];
      let bVal: any = b[sortConfig.key];

      if (sortConfig.key === "created_at") {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(String(bVal));
        return sortConfig.direction === "asc" ? cmp : -cmp;
      } else if (typeof aVal === "number") {
        const numBVal = Number(bVal);
        return sortConfig.direction === "asc"
          ? aVal - numBVal
          : numBVal - aVal;
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

  // Group orders by status
  const processingOrders = filteredRows.filter(
    (o) => o.status === "processing",
  );
  const pickupOrders = filteredRows.filter((o) => o.status === "for_pick-up");
  const deliveryOrders = filteredRows.filter(
    (o) => o.status === "for_delivery",
  );
  const otherOrders = filteredRows.filter(
    (o) =>
      !["processing", "for_pick-up", "for_delivery"].includes(o.status),
  );

  // Combine all grouped orders for pagination
  const groupedOrders = [
    ...processingOrders,
    ...pickupOrders,
    ...deliveryOrders,
    ...otherOrders,
  ];

  const totalPages = Math.ceil(groupedOrders.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const paginatedRows = groupedOrders.slice(startIdx, endIdx);

  const getStatusColor = (status: string) =>
    ({
      pending: "bg-gray-100 text-gray-700",
      for_pick_up: "bg-blue-100 text-blue-700",
      "for_pick-up": "bg-blue-100 text-blue-700",
      processing: "bg-orange-100 text-orange-700",
      for_delivery: "bg-purple-100 text-purple-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    }[status] || "bg-gray-100 text-gray-700");

  const getStatusLabel = (status: string) =>
    ({
      pending: "Pending",
      for_pick_up: "Pickup",
      "for_pick-up": "Pickup",
      processing: "Processing",
      for_delivery: "Delivery",
      completed: "Completed",
      cancelled: "Cancelled",
    }[status] || status);

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
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-3 gap-4">
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
              Search Customer
            </label>
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
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
                          onClick={() => handleSort("total_amount" as keyof Order)}
                          className="flex items-center gap-2 font-semibold text-sm text-gray-900 hover:text-blue-600 transition"
                        >
                          Customer <SortIcon field="total_amount" />
                        </button>
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
                          onClick={() => handleSort("created_at" as keyof Order)}
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
                            <button
                              onClick={() => setViewing(order)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    Showing {startIdx + 1} to{" "}
                    {Math.min(endIdx, groupedOrders.length)} of{" "}
                    {groupedOrders.length} orders
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        const diff = Math.abs(p - currentPage);
                        return diff < 3 || p === 1 || p === totalPages;
                      })
                      .map((p, i, arr) => (
                        <div key={p}>
                          {i > 0 && arr[i - 1] !== p - 1 && (
                            <span className="px-1 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${
                              currentPage === p
                                ? "bg-blue-600 text-white"
                                : "border border-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            {p}
                          </button>
                        </div>
                      ))}
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
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
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function ViewModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Modal Centered */}
      <div
        className="bg-white shadow-2xl rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-blue-50 to-blue-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            Order Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-xl font-light transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Customer & Order Info */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {order.customers
                ? `${order.customers.first_name} ${order.customers.last_name}`
                : "No customer"}
            </h3>
            <p className="text-sm text-gray-500">
              Order #{order.id.slice(0, 8)}
            </p>
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
            <DetailField label="Status" value={order.status} />
            <DetailField label="Source" value={order.source} />
            <DetailField
              label="Total Amount"
              value={`₱${order.total_amount.toFixed(2)}`}
            />
            <DetailField label="Created" value={formatToPST(order.created_at)} />
          </div>

          {/* Customer Contact */}
          {order.customers && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <DetailField
                label="Phone"
                value={order.customers.phone_number || "—"}
              />
              <DetailField
                label="Email"
                value={order.customers.email_address || "—"}
              />
            </div>
          )}

          {/* Handling */}
          {order.handling && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Pickup & Delivery
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Pickup Address</p>
                  <p className="text-sm text-gray-900">
                    {order.handling.pickup.address || "In-store"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Delivery Address</p>
                  <p className="text-sm text-gray-900">
                    {order.handling.delivery.address || "In-store"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Summary */}
          {order.breakdown?.summary && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Summary
              </h4>
              <div className="space-y-1 text-sm bg-gray-50 p-3 rounded">
                {order.breakdown.summary.subtotal_products !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Products:</span>
                    <span className="font-medium">
                      ₱{order.breakdown.summary.subtotal_products.toFixed(2)}
                    </span>
                  </div>
                )}
                {order.breakdown.summary.subtotal_services !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Services:</span>
                    <span className="font-medium">
                      ₱{order.breakdown.summary.subtotal_services.toFixed(2)}
                    </span>
                  </div>
                )}
                {order.breakdown.summary.handling !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Handling:</span>
                    <span className="font-medium">
                      ₱{order.breakdown.summary.handling.toFixed(2)}
                    </span>
                  </div>
                )}
                {order.breakdown.summary.service_fee !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Fee:</span>
                    <span className="font-medium">
                      ₱{order.breakdown.summary.service_fee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-300">
                  <span className="text-gray-700 font-semibold">Total:</span>
                  <span className="font-bold">
                    ₱{order.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Products */}
          {order.breakdown?.items && order.breakdown.items.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Products ({order.breakdown.items.length})
              </h4>
              <div className="space-y-2">
                {order.breakdown.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm p-2 rounded bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × ₱{item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-medium text-gray-900">
                      ₱{item.subtotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Baskets */}
          {order.breakdown?.baskets && order.breakdown.baskets.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Baskets ({order.breakdown.baskets.length})
              </h4>
              <div className="space-y-3">
                {order.breakdown.baskets.map((basket, idx) => (
                  <BasketCard key={idx} basket={basket} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
          >
            Close
          </button>
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

function BasketCard({ basket }: { basket: Order["breakdown"]["baskets"][0] }) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h5 className="font-semibold text-sm">
            Basket #{basket.basket_number}
          </h5>
          <p className="text-xs text-gray-600">Weight: {basket.weight} kg</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">
            ₱{basket.total.toFixed(2)}
          </div>
        </div>
      </div>

      {basket.basket_notes && (
        <p className="text-xs text-gray-700 mb-2 italic">
          "{basket.basket_notes}"
        </p>
      )}

      {basket.services && basket.services.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-50">
          <div className="space-y-1">
            {basket.services.map((service) => (
              <div
                key={service.id}
                className="text-xs text-gray-700 grid grid-cols-[1fr_70px_80px] gap-2"
              >
                <span className="font-medium truncate">
                  {service.service_name}
                  {service.is_premium && " (Premium)"}
                </span>
                <span className="text-gray-600 text-right">
                  ×{service.multiplier}
                </span>
                <span className="font-medium text-right">
                  ₱{service.subtotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
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
