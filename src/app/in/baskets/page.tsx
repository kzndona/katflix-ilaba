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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Processing Orders</h1>
        <button
          onClick={() => load()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {errorMsg}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          No orders being processed
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full p-3"
            >
              {/* Order Header */}
              <div className="mb-2 pb-2 border-b border-gray-200">
                <div className="font-semibold text-xs">
                  {order.customers?.first_name} {order.customers?.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  {countBaskets(order)} basket
                  {countBaskets(order) !== 1 ? "s" : ""} •{" "}
                  <span className="font-medium capitalize text-xs">
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Baskets - Expanded with Unified Timeline */}
              <div className="space-y-2 flex-1">
                {(order.breakdown?.baskets || []).map((basket, idx) => {
                  const nextAction = getTimelineNextAction(order, basket);

                  return (
                    <div
                      key={idx}
                      className="space-y-1.5 p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="text-xs font-bold text-gray-800">
                        Basket #{basket.basket_number} • {basket.weight}kg
                      </div>

                      {/* Unified Timeline - Pickup → Services → Delivery */}
                      <div className="space-y-1 bg-white p-1.5 rounded">
                        {/* PICKUP - Only show if pending or in progress */}
                        {(order.handling.pickup.status === "pending" ||
                          order.handling.pickup.status === "in_progress") &&
                          (() => {
                            const isActive =
                              order.handling.pickup.status === "in_progress";
                            const statusIcon = isActive ? "●" : "◯";
                            const statusColor = isActive
                              ? "text-blue-700"
                              : "text-gray-500";

                            return (
                              <div
                                className={`flex items-center justify-between px-1.5 py-1 rounded text-xs ${
                                  isActive ? "bg-blue-50" : "bg-gray-50"
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="font-medium">Pickup</span>
                                </div>
                                <span
                                  className={`text-lg font-bold ml-1 ${statusColor}`}
                                >
                                  {statusIcon}
                                </span>
                              </div>
                            );
                          })()}

                        {/* BASKET SERVICES - Sorted by sequence */}
                        {basket.services
                          .slice()
                          .sort((a: any, b: any) => {
                            const aType = (a.service_name || "").toLowerCase();
                            const bType = (b.service_name || "").toLowerCase();
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
                            const isActive =
                              service.status === "in_progress";
                            const isPending = service.status === "pending";

                            const statusIcon = isDone
                              ? "✓"
                              : isActive
                                ? "●"
                                : "◯";
                            const statusColor = isDone
                              ? "text-green-700"
                              : isActive
                                ? "text-blue-700"
                                : "text-gray-500";

                            return (
                              <div
                                key={sIdx}
                                className={`flex items-center justify-between px-1.5 py-1 rounded text-xs ${
                                  isDone
                                    ? "bg-green-50"
                                    : isActive
                                      ? "bg-blue-50"
                                      : "bg-gray-50"
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="font-medium">
                                    {service.service_name}
                                  </span>
                                  {service.is_premium && (
                                    <span className="ml-1 text-yellow-600 font-bold">
                                      ★
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-lg font-bold ml-1 ${statusColor}`}
                                >
                                  {statusIcon}
                                </span>
                              </div>
                            );
                          })}

                        {/* DELIVERY - Only show if pending or in progress */}
                        {(order.handling.delivery.address &&
                          (order.handling.delivery.status === "pending" ||
                            order.handling.delivery.status === "in_progress")) &&
                          (() => {
                            const isActive =
                              order.handling.delivery.status === "in_progress";
                            const statusIcon = isActive ? "●" : "◯";
                            const statusColor = isActive
                              ? "text-blue-700"
                              : "text-gray-500";

                            return (
                              <div
                                className={`flex items-center justify-between px-1.5 py-1 rounded text-xs ${
                                  isActive ? "bg-blue-50" : "bg-gray-50"
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="font-medium">Delivery</span>
                                </div>
                                <span
                                  className={`text-lg font-bold ml-1 ${statusColor}`}
                                >
                                  {statusIcon}
                                </span>
                              </div>
                            );
                          })()}
                      </div>

                      {/* Single Action Button */}
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
                                nextAction.basketNumber || basket.basket_number,
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
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition-colors ${
                            processingId === order.id
                              ? "bg-gray-400 text-white cursor-wait"
                              : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                          }`}
                        >
                          {processingId === order.id
                            ? "Processing..."
                            : nextAction.label}
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500 text-center py-2 px-2 bg-green-50 rounded border border-green-200">
                          Order Complete ✓
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
  );
}
