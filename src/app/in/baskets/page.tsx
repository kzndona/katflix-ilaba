"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/app/utils/supabase/client";

// Status filter type
type StatusFilter =
  | "pending"
  | "for_pick-up"
  | "processing"
  | "for_delivery"
  | "completed"
  | "cancelled";

// Order type matching new JSONB schema
type Order = {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  source?: "store" | "app"; // Add source field
  gcash_receipt_url?: string | null; // Add receipt URL
  handling: {
    pickup: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      started_at?: string;
      completed_at?: string;
      started_by?: string;
      completed_by?: string;
    };
    delivery: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      started_at?: string;
      completed_at?: string;
      started_by?: string;
      completed_by?: string;
    };
  };
  breakdown: {
    baskets: Array<{
      basket_number: number;
      weight: number;
      basket_notes: string | null;
      status: "pending" | "processing" | "completed";
      services: Array<{
        id: string;
        service_id: string;
        service_name: string;
        is_premium: boolean;
        multiplier: number;
        rate_per_kg: number;
        subtotal: number;
        status: "pending" | "in_progress" | "completed" | "skipped";
        started_at?: string;
        completed_at?: string;
        started_by?: string;
        completed_by?: string;
      }>;
      total: number;
    }>;
    audit_log?: Array<any>;
  };
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string | null;
  } | null;
};

// Service sequence for basket services
const SERVICE_SEQUENCE = ["wash", "spin", "dry", "iron", "fold"];

export default function BasketsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileOrderModal, setMobileOrderModal] = useState<Order | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>([
    "pending",
    "for_pick-up",
    "processing",
    "for_delivery",
  ]);

  // Get authenticated staff user
  useEffect(() => {
    async function getAuthUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.log("👤 Auth user:", user?.id);

        if (!user) {
          setErrorMsg("Not authenticated. Please log in.");
          setAuthLoading(false);
          return;
        }

        // Fetch staff record by auth_id
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("id")
          .eq("auth_id", user.id)
          .single();

        console.log("👤 Staff lookup result:", {
          authUserId: user.id,
          staffError: staffError?.message,
          staffData,
        });

        if (staffError || !staffData) {
          setErrorMsg("Staff profile not found. Contact administrator.");
          setAuthLoading(false);
          return;
        }

        console.log("✅ Staff ID resolved:", staffData.id);
        setStaffId(staffData.id);
      } catch (err: any) {
        setErrorMsg("Failed to get authentication: " + err.message);
      } finally {
        setAuthLoading(false);
      }
    }

    getAuthUser();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      load();
    }
  }, [authLoading]);

  // Live clock update every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const date = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setCurrentTime(`${hours}:${minutes}:${seconds} • ${date}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/orders/getOrdersWithBaskets");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();

      // Filter only non-completed processing orders
      const processingOrders = data.filter(
        (o: any) =>
          o.status !== "completed" &&
          (o.status === "pending" ||
            o.status === "for_pick-up" ||
            o.status === "processing" ||
            o.status === "for_delivery"),
      );

      setOrders(processingOrders);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Count orders by status
  const countByStatus = (status: StatusFilter) => {
    return orders.filter((o) => o.status === status).length;
  };

  // Toggle status filter
  const toggleStatus = (status: StatusFilter) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  // Filter orders by selected statuses
  const filteredOrders = orders.filter((o) =>
    selectedStatuses.includes(o.status as StatusFilter),
  );

  // TODO: Replace with actual authenticated session
  const getStaffId = () => {
    return staffId || "unknown";
  };

  const countBaskets = (order: Order) => order.breakdown?.baskets?.length || 0;

  // Check if all baskets in order have completed their services
  const canStartDelivery = (order: Order): boolean => {
    const baskets = order.breakdown?.baskets || [];
    return baskets.every((b) =>
      b.services.every(
        (s) => s.status === "completed" || s.status === "skipped",
      ),
    );
  };

  // Get the next pending item in the timeline (pickup → services → delivery)
  const getTimelineNextAction = (
    order: Order,
    basket: any,
  ): {
    label: string;
    action: "start" | "complete";
    type: "pickup" | "service" | "delivery"; // what we're acting on
    serviceIndex?: number;
    basketNumber?: number;
  } | null => {
    // STEP 1: Check if pickup is pending
    if (order.handling.pickup.status === "pending") {
      return {
        label: "Start Pickup",
        action: "start",
        type: "pickup",
      };
    }

    if (order.handling.pickup.status === "in_progress") {
      return {
        label: "Complete Pickup",
        action: "complete",
        type: "pickup",
      };
    }

    // STEP 2: If pickup is done (completed/skipped), check basket services
    const services = basket.services || [];

    // Check for in-progress service
    const inProgressIndex = services.findIndex(
      (s: any) => s.status === "in_progress",
    );
    if (inProgressIndex >= 0) {
      return {
        label: `Complete ${services[inProgressIndex].service_name}`,
        action: "complete",
        type: "service",
        serviceIndex: inProgressIndex,
        basketNumber: basket.basket_number,
      };
    }

    // Check for pending service
    const pendingIndex = services.findIndex((s: any) => s.status === "pending");
    if (pendingIndex >= 0) {
      return {
        label: `Start ${services[pendingIndex].service_name}`,
        action: "start",
        type: "service",
        serviceIndex: pendingIndex,
        basketNumber: basket.basket_number,
      };
    }

    // STEP 3: If all services done and delivery available
    if (
      order.handling.delivery.address &&
      order.handling.delivery.status === "pending"
    ) {
      return {
        label: "Start Delivery",
        action: "start",
        type: "delivery",
      };
    }

    if (
      order.handling.delivery.address &&
      order.handling.delivery.status === "in_progress"
    ) {
      return {
        label: "Complete Delivery",
        action: "complete",
        type: "delivery",
      };
    }

    return null;
  };

  // Unified API call for service/handling updates
  async function updateServiceStatus(
    orderId: string,
    basketNumber: number | null,
    handlingType: string | null,
    action: string,
  ) {
    setProcessingId(orderId);
    try {
      const body: any = {
        staffId: getStaffId(),
        action,
      };

      if (basketNumber !== null) {
        body.basketId = basketNumber;
      }
      if (handlingType) {
        body.handlingType = handlingType;
      }

      const res = await fetch(`/api/orders/${orderId}/serviceStatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update service");
      }

      await load();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectMobileOrder(orderId: string) {
    setRejectingId(orderId);
    console.log("🔴 REJECT - Starting reject for order:", {
      orderId,
      staffId,
      getStaffId: getStaffId(),
    });
    try {
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashier_id: getStaffId(),
          reason: "Rejected by staff",
          notes: "Order rejected through mobile order review",
        }),
      });

      console.log("🔴 REJECT - Response status:", res.status);

      if (!res.ok) {
        const error = await res.json();
        console.error("🔴 REJECT - Error response:", error);
        throw new Error(error.error || "Failed to reject order");
      }

      setMobileOrderModal(null);
      await load();
    } catch (err: any) {
      console.error("🔴 REJECT - Exception:", err);
      setErrorMsg(err.message);
    } finally {
      setRejectingId(null);
    }
  }

  if (authLoading)
    return <div className="p-6 text-center">Loading authentication...</div>;

  if (loading) return <div className="p-6 text-center">Loading orders...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto">
        {/* Header with Clock, Filters, and Refresh - All Inline with Separators */}
        <div className="flex items-center gap-8 mb-10 bg-white rounded-lg border border-gray-200 px-8 py-6 shadow-sm">
          {/* Left: Clock & Active Count */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              🕐 {currentTime}
            </h1>
            <p className="text-gray-600 mt-2 text-sm font-mono">
              {filteredOrders.length} active displayed
            </p>
          </div>

          {/* Separator */}
          <div className="h-12 w-px bg-linear-to-b from-transparent via-gray-300 to-transparent"></div>

          {/* Center: Filters in Container */}
          <div className="flex items-center gap-3">
            {/* Pending Filter */}
            <button
              onClick={() => toggleStatus("pending")}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold text-base transition-all ${
                selectedStatuses.includes("pending")
                  ? "bg-blue-100 text-blue-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("pending")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-blue-400 cursor-pointer"
              />
              <span>Pending</span>
              <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("pending")}
              </span>
            </button>

            {/* For Pickup Filter */}
            <button
              onClick={() => toggleStatus("for_pick-up")}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold text-base transition-all ${
                selectedStatuses.includes("for_pick-up")
                  ? "bg-teal-100 text-teal-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("for_pick-up")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-teal-400 cursor-pointer"
              />
              <span>Pickup</span>
              <span className="text-xs bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("for_pick-up")}
              </span>
            </button>

            {/* Processing Filter */}
            <button
              onClick={() => toggleStatus("processing")}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold text-base transition-all ${
                selectedStatuses.includes("processing")
                  ? "bg-amber-100 text-amber-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("processing")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-amber-400 cursor-pointer"
              />
              <span>Processing</span>
              <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("processing")}
              </span>
            </button>

            {/* For Delivery Filter */}
            <button
              onClick={() => toggleStatus("for_delivery")}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold text-base transition-all ${
                selectedStatuses.includes("for_delivery")
                  ? "bg-violet-100 text-violet-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("for_delivery")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-violet-400 cursor-pointer"
              />
              <span>Delivery</span>
              <span className="text-xs bg-violet-200 text-violet-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("for_delivery")}
              </span>
            </button>
          </div>

          {/* Separator */}
          <div className="h-12 w-px bg-linear-to-b from-transparent via-gray-300 to-transparent"></div>

          {/* Right: Refresh Button */}
          <button
            onClick={() => load()}
            className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-base whitespace-nowrap shadow-lg hover:shadow-xl"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800 text-sm font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg">
              No orders in selected status
            </p>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full border border-gray-100 shrink-0 w-80 snap-start"
              >
                {/* Order Header */}
                <div className="bg-linear-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-base">
                        {order.customers?.first_name}{" "}
                        {order.customers?.last_name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {order.customers?.phone_number && (
                          <span>{order.customers.phone_number}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-2 ${
                        order.status === "processing"
                          ? "bg-blue-200 text-blue-900"
                          : order.status === "for_pick-up"
                            ? "bg-orange-200 text-orange-900"
                            : order.status === "for_delivery"
                              ? "bg-purple-200 text-purple-900"
                              : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 font-medium mt-3">
                    {countBaskets(order)} basket
                    {countBaskets(order) !== 1 ? "s" : ""} • ₱
                    {order.total_amount.toFixed(2)}
                  </div>
                </div>

                {/* Baskets Container */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {(order.breakdown?.baskets || []).map((basket, idx) => {
                    const nextAction = getTimelineNextAction(order, basket);
                    const allServicesComplete = basket.services.every(
                      (s) => s.status === "completed" || s.status === "skipped",
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition"
                      >
                        {/* Basket Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              Basket #{basket.basket_number}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {basket.weight}kg • ₱{basket.total.toFixed(2)}
                            </div>
                          </div>
                          {allServicesComplete && (
                            <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                              ✓ Done
                            </div>
                          )}
                        </div>

                        {/* Timeline */}
                        <div className="space-y-1.5 mb-3">
                          {/* PICKUP */}
                          {(order.handling.pickup.status === "pending" ||
                            order.handling.pickup.status === "in_progress") && (
                            <div
                              className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                                order.handling.pickup.status === "in_progress"
                                  ? "bg-blue-100 text-blue-900 border border-blue-300"
                                  : "bg-white text-gray-700 border border-gray-200"
                              }`}
                            >
                              <span
                                className={`text-lg font-bold ${
                                  order.handling.pickup.status === "in_progress"
                                    ? "text-blue-600 animate-pulse"
                                    : "text-gray-400"
                                }`}
                              >
                                {order.handling.pickup.status === "in_progress"
                                  ? "●"
                                  : "○"}
                              </span>
                              <span>Pickup</span>
                            </div>
                          )}

                          {/* SERVICES */}
                          {basket.services
                            .slice()
                            .sort((a: any, b: any) => {
                              const aType = (
                                a.service_name || ""
                              ).toLowerCase();
                              const bType = (
                                b.service_name || ""
                              ).toLowerCase();
                              const sequence = [
                                "wash",
                                "spin",
                                "dry",
                                "iron",
                                "fold",
                              ];

                              let aIndex = -1,
                                bIndex = -1;
                              for (const svc of sequence) {
                                if (aIndex === -1 && aType.includes(svc))
                                  aIndex = sequence.indexOf(svc);
                                if (bIndex === -1 && bType.includes(svc))
                                  bIndex = sequence.indexOf(svc);
                              }

                              if (aIndex === -1) aIndex = 999;
                              if (bIndex === -1) bIndex = 999;
                              return aIndex - bIndex;
                            })
                            .map((service, sIdx) => {
                              const isDone =
                                service.status === "completed" ||
                                service.status === "skipped";
                              const isActive = service.status === "in_progress";

                              return (
                                <div
                                  key={sIdx}
                                  className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                                    isDone
                                      ? "bg-green-100 text-green-900 border border-green-300"
                                      : isActive
                                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                                        : "bg-white text-gray-700 border border-gray-200"
                                  }`}
                                >
                                  <span
                                    className={`text-lg font-bold ${
                                      isDone
                                        ? "text-green-600"
                                        : isActive
                                          ? "text-blue-600 animate-pulse"
                                          : "text-gray-400"
                                    }`}
                                  >
                                    {isDone ? "✓" : isActive ? "●" : "○"}
                                  </span>
                                  <span className="flex-1">
                                    {service.service_name}
                                  </span>
                                  {service.is_premium && (
                                    <span className="text-yellow-500 font-bold">
                                      ★
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                          {/* DELIVERY */}
                          {order.handling.delivery.address &&
                            (order.handling.delivery.status === "pending" ||
                              order.handling.delivery.status ===
                                "in_progress") && (
                              <div
                                className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                                  order.handling.delivery.status ===
                                  "in_progress"
                                    ? "bg-purple-100 text-purple-900 border border-purple-300"
                                    : "bg-white text-gray-700 border border-gray-200"
                                }`}
                              >
                                <span
                                  className={`text-lg font-bold ${
                                    order.handling.delivery.status ===
                                    "in_progress"
                                      ? "text-purple-600 animate-pulse"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {order.handling.delivery.status ===
                                  "in_progress"
                                    ? "●"
                                    : "○"}
                                </span>
                                <span>Delivery</span>
                              </div>
                            )}
                        </div>

                        {/* Action Button */}
                        {nextAction ? (
                          <>
                            {order.source === "app" &&
                            order.status === "pending" ? (
                              <button
                                onClick={() => setMobileOrderModal(order)}
                                disabled={processingId === order.id}
                                className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                              >
                                📸 View Screenshot
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (nextAction.type === "pickup") {
                                    updateServiceStatus(
                                      order.id,
                                      null,
                                      "pickup",
                                      nextAction.action,
                                    );
                                  } else if (nextAction.type === "service") {
                                    updateServiceStatus(
                                      order.id,
                                      nextAction.basketNumber ||
                                        basket.basket_number,
                                      null,
                                      nextAction.action,
                                    );
                                  } else if (nextAction.type === "delivery") {
                                    updateServiceStatus(
                                      order.id,
                                      null,
                                      "delivery",
                                      nextAction.action,
                                    );
                                  }
                                }}
                                disabled={processingId === order.id}
                                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                  processingId === order.id
                                    ? "bg-gray-300 text-gray-700 cursor-wait"
                                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                                }`}
                              >
                                {processingId === order.id
                                  ? "Processing..."
                                  : nextAction.label}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-green-700 text-center py-3 px-3 bg-green-50 rounded-lg border border-green-200 font-semibold">
                            ✓ Basket Complete
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Order Details Modal */}
        {mobileOrderModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setMobileOrderModal(null)}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          >
            {/* Modal - Click inside doesn't close */}
            <div
              className="relative bg-white shadow-xl w-11/12 h-5/6 max-w-4xl flex flex-col rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-linear-to-r from-purple-50 to-purple-100 px-6 py-4 border-b border-purple-200 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-gray-900">
                  Mobile Order Review
                </h2>
                <button
                  onClick={() => setMobileOrderModal(null)}
                  className="text-gray-600 hover:text-gray-900 text-2xl font-light"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content - Two Column Layout */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - Details */}
                <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-6 space-y-4">
                  {/* Customer Info */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Customer
                    </h3>
                    <p className="text-sm text-gray-700 font-medium">
                      {mobileOrderModal.customers?.first_name}{" "}
                      {mobileOrderModal.customers?.last_name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {mobileOrderModal.customers?.phone_number}
                    </p>
                  </div>

                  {/* Pickup Address */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      📍 Pickup
                    </h3>
                    <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
                      {mobileOrderModal.handling.pickup.address}
                    </p>
                  </div>

                  {/* Delivery Address */}
                  {mobileOrderModal.handling.delivery.address && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        🚚 Delivery
                      </h3>
                      <p className="text-sm text-gray-700 bg-orange-50 p-3 rounded border border-orange-200">
                        {mobileOrderModal.handling.delivery.address}
                      </p>
                    </div>
                  )}

                  {/* Order Total */}
                  <div className="bg-purple-50 p-4 rounded border border-purple-200 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">
                        Total:
                      </span>
                      <span className="text-2xl font-bold text-purple-600">
                        ₱{mobileOrderModal.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Panel - GCash Receipt */}
                <div className="w-1/2 bg-gray-50 overflow-hidden p-6 flex flex-col items-center justify-center">
                  {mobileOrderModal.gcash_receipt_url ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <h3 className="font-semibold text-gray-900 mb-3 shrink-0">
                        💳 GCash Receipt
                      </h3>
                      <img
                        src={
                          mobileOrderModal.gcash_receipt_url.startsWith("http")
                            ? mobileOrderModal.gcash_receipt_url
                            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gcash-receipts/${mobileOrderModal.gcash_receipt_url}`
                        }
                        alt="GCash Receipt"
                        className="flex-1 w-full object-contain"
                        onError={(e) => {
                          console.error(
                            "Image failed to load:",
                            (e.target as HTMLImageElement).src,
                          );
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2216%22 fill=%22%23999%22%3EImage failed to load%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">No receipt image</p>
                  )}
                </div>
              </div>

              {/* Modal Footer - Actions */}
              <div className="border-t border-gray-200 px-6 py-4 flex gap-3 shrink-0 bg-white">
                <button
                  onClick={async () => {
                    await updateServiceStatus(
                      mobileOrderModal.id,
                      null,
                      "pickup",
                      "start",
                    );
                    setMobileOrderModal(null);
                  }}
                  disabled={processingId === mobileOrderModal.id}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    processingId === mobileOrderModal.id
                      ? "bg-gray-300 text-gray-700 cursor-wait"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {processingId === mobileOrderModal.id
                    ? "Processing..."
                    : "Start Pickup"}
                </button>
                <button
                  onClick={() => rejectMobileOrder(mobileOrderModal.id)}
                  disabled={rejectingId === mobileOrderModal.id}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    rejectingId === mobileOrderModal.id
                      ? "bg-gray-300 text-gray-700 cursor-wait"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {rejectingId === mobileOrderModal.id
                    ? "Rejecting..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
