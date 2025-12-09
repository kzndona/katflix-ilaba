"use client";

import { useEffect, useState } from "react";
import { formatToPST } from "@/src/app/utils/dateUtils";

type ServiceDetail = {
  id: string;
  service_id: string;
  basket_id: string;
  rate: number;
  subtotal: number;
  status?: string;
  service_type?: string;
  service_name?: string;
};

type BasketDetail = {
  id: string;
  order_id: string;
  basket_number: number;
  weight: number | null;
  notes: string | null;
  price: number | null;
  status: string;
  created_at: string | null;
  services: ServiceDetail[];
  customer_name?: string | null;
  phone_number?: string | null;
  email_address?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  orderStatus?: string | null;
  handling?: {
    id: string;
    type: string;
    address: string;
  } | null;
  washPremium?: boolean;
  dryPremium?: boolean;
};

const serviceTypeOrder = ["pickup", "wash", "dry", "spin", "iron", "fold", "delivery"];

// Color palette for different orders
const colorPalette = [
  { border: "border-blue-500", bg: "bg-blue-50" },
  { border: "border-purple-500", bg: "bg-purple-50" },
  { border: "border-pink-500", bg: "bg-pink-50" },
  { border: "border-green-500", bg: "bg-green-50" },
  { border: "border-yellow-500", bg: "bg-yellow-50" },
  { border: "border-indigo-500", bg: "bg-indigo-50" },
  { border: "border-teal-500", bg: "bg-teal-50" },
  { border: "border-orange-500", bg: "bg-orange-50" },
];

export default function BasketsPage() {
  const [baskets, setBaskets] = useState<BasketDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Map order IDs to colors for grouping
  const getOrderColor = (orderId: string) => {
    const orderIndex = baskets.findIndex((b) => b.order_id === orderId);
    const uniqueOrderIds = Array.from(new Set(baskets.map((b) => b.order_id)));
    const uniqueIndex = uniqueOrderIds.indexOf(orderId);
    return colorPalette[uniqueIndex % colorPalette.length];
  };

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/baskets/getProcessing");
      if (!res.ok) throw new Error("Failed to load baskets");
      const data = await res.json();
      setBaskets(data || []);

      // Auto-complete pickup/delivery if they are in-store (null)
      for (const basket of data || []) {
        // Auto-complete pickup if it's in-store (null = instore)
        if (!basket.pickupAddress && basket.orderStatus === "pick-up") {
          await completePickup(basket.id, true);
        }
        
        // Auto-complete delivery if it's in-store (null = instore)
        if (!basket.deliveryAddress && basket.orderStatus === "delivering") {
          await completeDelivery(basket.id, true);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function completeService(basketId: string, serviceType?: string, silent: boolean = false) {
    setProcessingId(basketId);
    try {
      const res = await fetch("/api/baskets/completeService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, serviceType }),
      });
      if (!res.ok) throw new Error("Failed to complete service");
      await load();
    } catch (err: any) {
      if (!silent) alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function completePickup(basketId: string, silent: boolean = false) {
    setProcessingId(basketId);
    try {
      const res = await fetch("/api/baskets/completeService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, serviceType: "pickup" }),
      });
      if (!res.ok) throw new Error("Failed to complete pickup");
      await load();
    } catch (err: any) {
      if (!silent) alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function completeDelivery(basketId: string, silent: boolean = false) {
    setProcessingId(basketId);
    try {
      const res = await fetch("/api/baskets/completeService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, serviceType: "delivery" }),
      });
      if (!res.ok) throw new Error("Failed to complete delivery");
      await load();
    } catch (err: any) {
      if (!silent) alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function notifyCustomer(basketId: string, orderId: string) {
    setProcessingId(basketId);
    try {
      const res = await fetch("/api/baskets/notifyCustomer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, orderId }),
      });
      if (!res.ok) throw new Error("Failed to notify customer");
      alert("Customer notified successfully");
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  const getInProgressServiceType = (basket: BasketDetail): string | null => {
    const inProgressService = basket.services.find(
      (s) => s.status === "in_progress"
    );
    return inProgressService?.service_type?.toLowerCase() || null;
  };

  const getNextServiceType = (basket: BasketDetail): string | null => {
    const inProgressService = basket.services.find(
      (s) => s.status === "in_progress"
    );

    if (!inProgressService) return null;

    const currentIndex = serviceTypeOrder.indexOf(
      inProgressService.service_type?.toLowerCase() || ""
    );

    // Find the next service in the sequence that has status "pending"
    for (let i = currentIndex + 1; i < serviceTypeOrder.length; i++) {
      const nextType = serviceTypeOrder[i];
      const nextService = basket.services.find(
        (s) =>
          s.service_type?.toLowerCase() === nextType && s.status === "pending"
      );
      if (nextService) return nextType;
    }

    return null;
  };

  const canCompleteBasket = (basket: BasketDetail): boolean => {
    // Check if current service is the last one in the chain
    const inProgressService = basket.services.find(
      (s) => s.status === "in_progress"
    );

    if (!inProgressService) return false;

    const currentType = inProgressService.service_type?.toLowerCase() || "";
    const currentIndex = serviceTypeOrder.indexOf(currentType);

    // Check if there are any pending services after this one
    const hasPendingAfter = basket.services.some((s) => {
      const sType = s.service_type?.toLowerCase() || "";
      const sIndex = serviceTypeOrder.indexOf(sType);
      return s.status === "pending" && sIndex > currentIndex;
    });

    return !hasPendingAfter;
  };

  const areAllBasketsReadyForDelivery = (currentBasket: BasketDetail): boolean => {
    // Check if all baskets in this order are in delivery phase or already completed
    const orderBaskets = baskets.filter((b) => b.order_id === currentBasket.order_id);
    // Single basket orders are always "ready" - don't need to wait
    if (orderBaskets.length === 1) {
      return true;
    }
    return orderBaskets.every(
      (b) => b.orderStatus === "delivering" || b.status === "completed"
    );
  };

  const hasBasketCompletedPickup = (basket: BasketDetail): boolean => {
    // Check if THIS basket has moved past pickup (has at least one service in progress or completed)
    return basket.services.some((s) => s.status === "in_progress" || s.status === "completed");
  };

  const areAllBasketsPastPickup = (currentBasket: BasketDetail): boolean => {
    // Check if all baskets in this order have moved past pickup phase
    const orderBaskets = baskets.filter((b) => b.order_id === currentBasket.order_id);
    // Single basket orders are always "ready" - don't need to wait
    if (orderBaskets.length === 1) {
      return true;
    }
    // All baskets must have at least one service in progress or completed (meaning they're past pickup)
    return orderBaskets.every(
      (b) => b.services.some((s) => s.status === "in_progress" || s.status === "completed")
    );
  };

  const groupServicesByType = (basket: BasketDetail) => {
    const grouped: Record<string, ServiceDetail[]> = {};
    basket.services.forEach((service) => {
      const type = service.service_type?.toLowerCase() || "unknown";
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(service);
    });
    return grouped;
  };

  if (loading) return <div className="p-6 text-center">Loading baskets...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Processing Baskets</h1>
        <button
          onClick={() => load()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMsg}
        </div>
      )}

      {baskets.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          No baskets to process
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {baskets.map((basket) => {
            const nextServiceType = getNextServiceType(basket);
            const grouped = groupServicesByType(basket);
            const orderColor = getOrderColor(basket.order_id);

            return (
              <div
                key={basket.id}
                className={`bg-white rounded-lg shadow-md p-5 border-l-4 ${orderColor.border} border-opacity-70 ${orderColor.bg} border-opacity-20 flex flex-col h-full`}
              >
                {/* Header - Name + Basket Number */}
                <div className="mb-4 pb-3 border-b border-gray-200">
                  <p className="text-base font-bold text-gray-900 line-clamp-2">
                    {basket.customer_name} • Basket {basket.basket_number}
                  </p>
                </div>

                {/* Contact Info */}
                <div className="text-sm text-gray-600 space-y-2 mb-4">
                  {basket.phone_number && (
                    <p className="truncate">
                      <span className="font-semibold">📞</span>{" "}
                      {basket.phone_number}
                    </p>
                  )}
                  {basket.email_address && (
                    <p className="truncate">
                      <span className="font-semibold">✉️</span>{" "}
                      {basket.email_address}
                    </p>
                  )}
                </div>

                {/* Handling Info - Show pickup/delivery badges */}
                {basket.pickupAddress && (
                  <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700">
                      🏪 PICKUP AT STORE
                    </p>
                    <p className="text-xs text-amber-600 truncate">
                      {basket.pickupAddress}
                    </p>
                  </div>
                )}
                {basket.deliveryAddress && (
                  <div className="mb-3 p-2 rounded bg-cyan-50 border border-cyan-200">
                    <p className="text-xs font-semibold text-cyan-700">
                      🚚 DELIVERY TO CUSTOMER
                    </p>
                    <p className="text-xs text-cyan-600 truncate">
                      {basket.deliveryAddress}
                    </p>
                  </div>
                )}
                {(basket.pickupAddress || basket.deliveryAddress) && (
                  <div className="mb-3" />
                )}

                {/* Basket Info */}
                <div className="text-sm space-y-2 mb-4 pb-3 border-b border-gray-200">
                  <p>
                    <strong>Weight:</strong> {basket.weight} kg
                  </p>
                  {basket.notes && (
                    <p className="text-gray-600 line-clamp-2">
                      <strong>Notes:</strong> {basket.notes}
                    </p>
                  )}
                </div>

                {/* Services by Type - Full timeline including pickup/delivery */}
                <div className="mb-4 space-y-2 grow">
                  {serviceTypeOrder.map((type) => {
                    const typeServices = grouped[type];
                    if (!typeServices || typeServices.length === 0) return null;

                    const inProgressType = getInProgressServiceType(basket);
                    let isInProgress = type === inProgressType;
                    let isCompleted = typeServices.every(
                      (s) => s.status === "completed"
                    );
                    
                    // Special handling for virtual services (pickup/delivery)
                    if (type === "pickup") {
                      // Pickup is completed if basket has moved past pickup (has any in-progress/completed service)
                      isCompleted = hasBasketCompletedPickup(basket);
                      // Pickup is in-progress only if order is in pick-up AND this basket hasn't completed pickup
                      isInProgress = basket.orderStatus === "pick-up" && !isCompleted;
                    }
                    if (type === "delivery") {
                      // Delivery is in-progress when order is delivering
                      isInProgress = basket.orderStatus === "delivering";
                    }

                    // Check if wash or dry is premium
                    const isPremium =
                      (type === "wash" && basket.washPremium) ||
                      (type === "dry" && basket.dryPremium);

                    let bgClass = "bg-gray-50 border-gray-200 text-gray-600";
                    if (isCompleted) {
                      bgClass = "bg-green-50 border-green-200 text-green-700";
                    } else if (isInProgress) {
                      bgClass = "bg-blue-50 border-blue-200 text-blue-700";
                    }

                    return (
                      <div
                        key={type}
                        className={`p-2 rounded text-sm border ${bgClass}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-semibold capitalize">
                            {type}
                            {isPremium && (
                              <span className="ml-1 text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded">
                                Premium
                              </span>
                            )}
                            {isCompleted && <span className="ml-1">✓</span>}
                            {isInProgress && <span className="ml-1">●</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons - Notify (if pickup/delivery) + Next Service */}
                <div className="space-y-2">
                  {(basket.orderStatus === "pick-up" || basket.orderStatus === "delivering") && (
                    <button
                      onClick={() => notifyCustomer(basket.id, basket.order_id)}
                      disabled={processingId === basket.id}
                      className="w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-wait"
                    >
                      {processingId === basket.id
                        ? "Notifying..."
                        : basket.orderStatus === "pick-up"
                          ? "Notify (Pickup Ready)"
                          : "Notify (Ready for Delivery)"}
                    </button>
                  )}
                  <button
                    onClick={() => completeService(basket.id)}
                    disabled={
                      (!nextServiceType && !canCompleteBasket(basket)) ||
                      processingId === basket.id ||
                      (canCompleteBasket(basket) && !areAllBasketsReadyForDelivery(basket)) ||
                      (!!basket.pickupAddress && hasBasketCompletedPickup(basket) && !areAllBasketsPastPickup(basket))
                    }
                    className={`w-full px-3 py-3 rounded-lg font-semibold text-base transition-all ${
                      processingId === basket.id
                        ? "bg-gray-400 text-white cursor-wait"
                        : !!basket.pickupAddress && hasBasketCompletedPickup(basket) && !areAllBasketsPastPickup(basket)
                          ? "bg-yellow-400 text-yellow-900 cursor-not-allowed"
                          : canCompleteBasket(basket) && !areAllBasketsReadyForDelivery(basket)
                            ? "bg-yellow-400 text-yellow-900 cursor-not-allowed"
                            : !nextServiceType && !canCompleteBasket(basket)
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : canCompleteBasket(basket)
                                ? "bg-linear-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg"
                                : "bg-linear-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    {processingId === basket.id
                      ? "Processing..."
                      : !!basket.pickupAddress && hasBasketCompletedPickup(basket) && !areAllBasketsPastPickup(basket)
                        ? "⏳ Waiting for other baskets"
                        : canCompleteBasket(basket) && !areAllBasketsReadyForDelivery(basket)
                          ? "⏳ Waiting for other baskets"
                          : canCompleteBasket(basket)
                            ? "Complete ✓"
                            : nextServiceType
                              ? "Next Service →"
                              : "Waiting"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
