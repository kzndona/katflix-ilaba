"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/app/utils/supabase/client";

// Order type matching new JSONB schema
type Order = {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
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

  // Get authenticated staff user
  useEffect(() => {
    async function getAuthUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setErrorMsg("Not authenticated. Please log in.");
          setAuthLoading(false);
          return;
        }

        setStaffId(user.id);
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
            o.status === "for_delivery")
      );

      setOrders(processingOrders);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

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
        (s) => s.status === "completed" || s.status === "skipped"
      )
    );
  };

  // Get the next pending item in the timeline (pickup → services → delivery)
  const getTimelineNextAction = (
    order: Order,
    basket: any
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
      (s: any) => s.status === "in_progress"
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
    action: string
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

  if (authLoading)
    return <div className="p-6 text-center">Loading authentication...</div>;

  if (loading) return <div className="p-6 text-center">Loading orders...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className=" mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Processing Orders
            </h1>
            <p className="text-gray-500 mt-2">
              {orders.length} active order{orders.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => load()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
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
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg">No orders being processed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full border border-gray-100"
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
                      (s) => s.status === "completed" || s.status === "skipped"
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
                          <button
                            onClick={() => {
                              if (nextAction.type === "pickup") {
                                updateServiceStatus(
                                  order.id,
                                  null,
                                  "pickup",
                                  nextAction.action
                                );
                              } else if (nextAction.type === "service") {
                                updateServiceStatus(
                                  order.id,
                                  nextAction.basketNumber ||
                                    basket.basket_number,
                                  null,
                                  nextAction.action
                                );
                              } else if (nextAction.type === "delivery") {
                                updateServiceStatus(
                                  order.id,
                                  null,
                                  "delivery",
                                  nextAction.action
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
      </div>
    </div>
  );
}
