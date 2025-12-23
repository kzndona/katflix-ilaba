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

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

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

  // Get the next action for a basket
  const getBasketNextAction = (
    basket: any
  ): {
    label: string;
    action: "start" | "complete" | "ready";
    serviceIndex: number;
  } | null => {
    const services = basket.services || [];

    // PRIORITY 1: If any service is currently in_progress, show COMPLETE button
    const inProgressIndex = services.findIndex(
      (s: any) => s.status === "in_progress"
    );
    if (inProgressIndex >= 0) {
      return {
        label: `Complete ${services[inProgressIndex].service_name}`,
        action: "complete",
        serviceIndex: inProgressIndex,
      };
    }

    // PRIORITY 2: If first pending exists and no in_progress before it, show START button
    const pendingIndex = services.findIndex((s: any) => s.status === "pending");
    if (pendingIndex >= 0) {
      return {
        label: `Start ${services[pendingIndex].service_name}`,
        action: "start",
        serviceIndex: pendingIndex,
      };
    }

    // PRIORITY 3: All services done
    return {
      label: "Done",
      action: "ready",
      serviceIndex: -1,
    };
  };

  // Handle pickup confirmation with multi-basket warning
  const handlePickupConfirmation = (order: Order) => {
    const basketCount = countBaskets(order);
    setConfirmModal({
      isOpen: true,
      title: "Confirm Pickup",
      message: `Complete pickup for ${basketCount} basket${basketCount > 1 ? "s" : ""} in this order?`,
      action: async () => {
        await updateServiceStatus(order.id, null, "pickup", "complete");
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  // Handle delivery confirmation with multi-basket warning
  const handleDeliveryConfirmation = (order: Order) => {
    const basketCount = countBaskets(order);
    setConfirmModal({
      isOpen: true,
      title: "Confirm Delivery",
      message: `Confirm that all ${basketCount} basket${basketCount > 1 ? "s" : ""} are ready for delivery?`,
      action: async () => {
        await updateServiceStatus(order.id, null, "delivery", "start");
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
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

              {/* Handling Services - Compact */}
              <div className="space-y-1 mb-2 pb-2 border-b border-gray-200 text-xs">
                {/* Pickup */}
                <div className="flex items-center gap-1">
                  <div className="font-semibold w-14 shrink-0">Pickup</div>
                  <div
                    className={`flex-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                      order.handling.pickup.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : order.handling.pickup.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : order.handling.pickup.status === "skipped"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {order.handling.pickup.status
                      .replace(/_/g, " ")
                      .charAt(0)
                      .toUpperCase() +
                      order.handling.pickup.status.replace(/_/g, " ").slice(1)}
                  </div>
                  {order.handling.pickup.status === "pending" && (
                    <button
                      onClick={() => handlePickupConfirmation(order)}
                      disabled={processingId === order.id}
                      className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400 shrink-0"
                    >
                      Go
                    </button>
                  )}
                  {order.handling.pickup.status === "in_progress" && (
                    <button
                      onClick={() =>
                        updateServiceStatus(
                          order.id,
                          null,
                          "pickup",
                          "complete"
                        )
                      }
                      disabled={processingId === order.id}
                      className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 shrink-0"
                    >
                      Done
                    </button>
                  )}
                </div>

                {/* Delivery */}
                {order.handling.delivery.address && (
                  <div className="flex items-center gap-1">
                    <div className="font-semibold w-14 shrink-0">Delivery</div>
                    <div
                      className={`flex-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        order.handling.delivery.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : order.handling.delivery.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : order.handling.delivery.status === "skipped"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {order.handling.delivery.status
                        .replace(/_/g, " ")
                        .charAt(0)
                        .toUpperCase() +
                        order.handling.delivery.status
                          .replace(/_/g, " ")
                          .slice(1)}
                    </div>
                    {order.handling.delivery.status === "pending" && (
                      <button
                        onClick={() => handleDeliveryConfirmation(order)}
                        disabled={
                          !canStartDelivery(order) || processingId === order.id
                        }
                        className={`px-1.5 py-0.5 text-xs rounded font-semibold shrink-0 ${
                          !canStartDelivery(order)
                            ? "bg-yellow-300 text-yellow-900 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                        }`}
                      >
                        {!canStartDelivery(order) ? "..." : "Go"}
                      </button>
                    )}
                    {order.handling.delivery.status === "in_progress" && (
                      <button
                        onClick={() =>
                          updateServiceStatus(
                            order.id,
                            null,
                            "delivery",
                            "complete"
                          )
                        }
                        disabled={processingId === order.id}
                        className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 shrink-0"
                      >
                        Done
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Baskets - Expanded */}
              <div className="space-y-2 flex-1">
                {(order.breakdown?.baskets || []).map((basket, idx) => {
                  const nextAction = getBasketNextAction(basket);

                  return (
                    <div
                      key={idx}
                      className="space-y-1.5 p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="text-xs font-bold text-gray-800">
                        Basket #{basket.basket_number} • {basket.weight}kg
                      </div>

                      {/* Services - Detailed List */}
                      <div className="space-y-1 bg-white p-1.5 rounded">
                        {/* Sort services by sequence order */}
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
                            const isActive = service.status === "in_progress";
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
                                  {service.duration_in_minutes && (
                                    <span className="ml-1 text-gray-500">
                                      ({service.duration_in_minutes}m)
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
                      </div>

                      {/* Status Summary */}
                      <div className="text-xs text-gray-600 px-1">
                        {(() => {
                          const completed = basket.services.filter(
                            (s) => s.status === "completed"
                          ).length;
                          const total = basket.services.length;
                          return `${completed}/${total} complete`;
                        })()}
                      </div>

                      {/* Action button */}
                      {nextAction ? (
                        <button
                          onClick={() => {
                            if (
                              nextAction.action === "start" ||
                              nextAction.action === "complete"
                            ) {
                              updateServiceStatus(
                                order.id,
                                basket.basket_number,
                                null,
                                nextAction.action
                              );
                            }
                          }}
                          disabled={
                            processingId === order.id ||
                            (order.handling.pickup.status !== "completed" &&
                              order.handling.pickup.status !== "skipped")
                          }
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition-colors ${
                            processingId === order.id
                              ? "bg-gray-400 text-white cursor-wait"
                              : order.handling.pickup.status !== "completed" &&
                                  order.handling.pickup.status !== "skipped"
                                ? "bg-yellow-300 text-yellow-900 cursor-not-allowed border border-yellow-400"
                                : nextAction.action === "ready"
                                  ? "bg-green-100 text-green-800 cursor-default border border-green-300"
                                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                          }`}
                        >
                          {processingId === order.id
                            ? "Processing..."
                            : order.handling.pickup.status !== "completed" &&
                                order.handling.pickup.status !== "skipped"
                              ? "Complete Pickup First"
                              : nextAction.label}
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500 text-center py-2 px-2 bg-yellow-50 rounded border border-yellow-200">
                          No pending action (check basket status above)
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

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-bold mb-4">{confirmModal.title}</h3>
            <p className="text-gray-700 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmModal({ ...confirmModal, isOpen: false })
                }
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
