"use client";

import { useEffect, useState } from "react";

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
  weight: number | null;
  notes: string | null;
  price: number | null;
  status: string;
  created_at: string | null;
  services: ServiceDetail[];
  customer_name?: string | null;
};

const serviceTypeOrder = ["wash", "dry", "spin", "iron", "fold"];

export default function BasketsPage() {
  const [baskets, setBaskets] = useState<BasketDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function completeService(basketId: string) {
    setProcessingId(basketId);
    try {
      const res = await fetch("/api/baskets/completeService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId }),
      });
      if (!res.ok) throw new Error("Failed to complete service");
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
    // There must be an in_progress service and no pending services to complete
    const hasInProgress = basket.services.some(
      (s) => s.status === "in_progress"
    );
    const hasPending = basket.services.some((s) => s.status === "pending");
    return hasInProgress && !hasPending;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {baskets.map((basket) => {
            const nextServiceType = getNextServiceType(basket);
            const grouped = groupServicesByType(basket);

            return (
              <div
                key={basket.id}
                className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500"
              >
                {/* Header */}
                <div className="mb-4 pb-3 border-b">
                  <p className="text-xs text-gray-500">Order ID</p>
                  <p className="text-lg font-bold text-blue-600">
                    {basket.order_id.slice(0, 8).toUpperCase()}
                  </p>
                  {basket.customer_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      {basket.customer_name}
                    </p>
                  )}
                </div>

                {/* Basket Info */}
                <div className="text-sm space-y-1 mb-4">
                  <p>
                    <strong>Weight:</strong> {basket.weight} kg
                  </p>
                  {basket.notes && (
                    <p>
                      <strong>Notes:</strong> {basket.notes}
                    </p>
                  )}
                </div>

                {/* Services by Type */}
                <div className="mb-4 space-y-2">
                  {serviceTypeOrder.map((type) => {
                    const typeServices = grouped[type];
                    if (!typeServices || typeServices.length === 0) return null;

                    const inProgressType = getInProgressServiceType(basket);
                    const isInProgress = type === inProgressType;
                    const isCompleted = typeServices.every(
                      (s) => s.status === "completed"
                    );

                    const totalPrice = typeServices.reduce(
                      (sum, s) => sum + s.subtotal,
                      0
                    );

                    let bgClass = "bg-gray-100 border-gray-300 text-gray-600";
                    if (isCompleted) {
                      bgClass = "bg-green-100 border-green-300 text-green-800";
                    } else if (isInProgress) {
                      bgClass = "bg-blue-100 border-blue-300 text-blue-800";
                    }

                    return (
                      <div
                        key={type}
                        className={`p-2 rounded text-sm border-2 ${bgClass}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize flex items-center gap-2">
                            {type}

                            {isCompleted && (
                              <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                                ✓
                              </span>
                            )}

                            {isInProgress && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                In Progress
                              </span>
                            )}
                          </span>

                          <span className="text-xs">
                            ₱{totalPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => completeService(basket.id)}
                  disabled={
                    (!nextServiceType && !canCompleteBasket(basket)) ||
                    processingId === basket.id
                  }
                  className="w-full px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300 font-medium hover:bg-green-700 disabled:cursor-not-allowed hover:cursor-pointer disabled:hover:cursor-not-allowed"
                >
                  {processingId === basket.id
                    ? "Processing..."
                    : canCompleteBasket(basket)
                      ? "Complete"
                      : nextServiceType
                        ? "Next Service"
                        : "Completed"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
