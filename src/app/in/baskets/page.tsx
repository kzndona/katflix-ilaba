"use client";

// Suppress Next.js async params warnings in development
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("params are being enumerated") ||
        args[0].includes("searchParams") ||
        args[0].includes("React.use()"))
    ) {
      return; // Suppress these warnings
    }
    originalWarn(...args);
  };
}

import { useEffect, useState } from "react";
import { createClient } from "@/src/app/utils/supabase/client";
import ReceiptModal from "@/src/app/in/pos/components/receiptModal";
import {
  formatReceiptAsPlaintext,
  CompactReceipt,
} from "@/src/app/in/pos/logic/receiptGenerator";
import OrderModificationModal from "./OrderModificationModal";

// Status filter type
type StatusFilter = "pending" | "processing" | "completed" | "cancelled";

// Order type matching updated schema
type Order = {
  id: string;
  source: "pos" | "mobile";
  customer_id: string;
  cashier_id: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  gcash_receipt_url?: string | null;
  handling: {
    service_type?: string;
    handling_type?: string;
    payment_method?: string;
    pickup_address?: string;
    delivery_address?: string;
    scheduled?: boolean;
    scheduled_date?: string;
    scheduled_time?: string;
    pickup: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      started_at?: string;
      completed_at?: string;
    };
    delivery: {
      address: string;
      status: "pending" | "in_progress" | "completed" | "skipped";
      started_at?: string;
      completed_at?: string;
    };
  };
  breakdown: {
    items: Array<any>;
    baskets: Array<{
      basket_number: number;
      weight: number;
      basket_notes: string | null;
      total: number;
      services: Array<{
        service_type: string;
        status: "pending" | "in_progress" | "completed" | "skipped";
        started_at?: string;
        completed_at?: string;
        notes?: string;
      }>;
      services_data?: Record<string, any>; // Pricing snapshots
    }>;
    summary?: Record<string, any>;
  };
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string | null;
  } | null;
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

// Service sequence for basket services
const SERVICE_SEQUENCE = ["wash", "spin", "dry", "iron", "fold"];
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>([
    "pending",
    "processing",
  ]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptContent, setReceiptContent] = useState("");
  const [showOrderEditor, setShowOrderEditor] = useState<Order | null>(null);

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

  // Auto-refresh orders every 30 seconds (paused when editor modal is open)
  useEffect(() => {
    if (showOrderEditor) return; // skip refresh while modifying an order

    const interval = setInterval(() => {
      load();
      setLastRefresh(new Date());
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [showOrderEditor, load]);

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
      const res = await fetch("/api/orders/withServiceStatus");
      if (!res.ok) throw new Error("Failed to load orders");
      const response = await res.json();

      if (!response.success) {
        throw new Error(response.error || "Failed to load orders");
      }

      console.log("[LOAD ORDERS] Total orders from API:", response.data.length);
      response.data.forEach((o: any) => {
        console.log(`[LOAD ORDERS] Order ${o.id}: status="${o.status}"`);
      });

      // Filter only non-completed processing orders
      const processingOrders = response.data.filter(
        (o: any) =>
          o.status !== "completed" &&
          (o.status === "pending" || o.status === "processing"),
      );

      // Parse breakdown and handling JSON strings into objects
      const parsedOrders = processingOrders.map((o: any) => {
        const parsed = {
          ...o,
          breakdown:
            typeof o.breakdown === "string"
              ? JSON.parse(o.breakdown)
              : o.breakdown,
          handling:
            typeof o.handling === "string"
              ? JSON.parse(o.handling)
              : o.handling,
        };
        console.log(
          "[PARSE ORDERS] Order",
          o.id,
          "parsed handling:",
          parsed.handling,
        );
        return parsed;
      });

      console.log(
        "[LOAD ORDERS] Filtered processing orders:",
        parsedOrders.length,
      );

      setOrders(parsedOrders);
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

  // Check if scheduled delivery is in the future
  const isScheduledDeliveryInFuture = (order: Order): boolean => {
    if (
      !order.handling?.scheduled ||
      !order.handling?.scheduled_date ||
      !order.handling?.scheduled_time
    ) {
      return false;
    }
    const scheduledDateTime = new Date(
      `${order.handling.scheduled_date}T${order.handling.scheduled_time}`,
    );
    const now = new Date();
    return now < scheduledDateTime;
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

  // Get the next order-level action (pickup or delivery only, not services)
  const getOrderNextAction = (
    order: Order,
  ): {
    label: string;
    action: "start" | "complete";
    type: "pickup" | "delivery";
  } | null => {
    if (!order.handling || !order.handling.pickup) {
      return null;
    }

    const pickupAddr = order.handling.pickup.address?.toLowerCase() || "";
    const isStorePickup = pickupAddr === "in-store" || pickupAddr === "store";

    // STEP 1: Check if pickup is pending (unless store pickup)
    if (!isStorePickup && order.handling.pickup.status === "pending") {
      return {
        label: "Start Pickup",
        action: "start",
        type: "pickup",
      };
    }

    if (!isStorePickup && order.handling.pickup.status === "in_progress") {
      return {
        label: "Complete Pickup",
        action: "complete",
        type: "pickup",
      };
    }

    // STEP 2: If pickup is done (or store pickup), check if all services are done
    if (!canStartDelivery(order)) {
      return null;
    }

    // STEP 3: If all services done, check delivery
    const deliveryAddr = order.handling.delivery?.address?.toLowerCase() || "";
    const isStoreDelivery =
      deliveryAddr === "in-store" || deliveryAddr === "store";

    if (
      order.handling.delivery?.address &&
      !isStoreDelivery &&
      order.handling.delivery.status === "pending"
    ) {
      return {
        label: "Start Delivery",
        action: "start",
        type: "delivery",
      };
    }

    if (
      order.handling.delivery?.address &&
      !isStoreDelivery &&
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

  // Get the next pending item in the timeline (pickup → services → delivery)
  // If pickup address is "In-store" or "store" (POS), skip the pickup phase entirely
  const getTimelineNextAction = (
    order: Order,
    basket: any,
  ): {
    label: string;
    action: "start" | "complete";
    type: "pickup" | "service" | "delivery";
    serviceType?: string;
    basketNumber?: number;
  } | null => {
    // Safety check: ensure handling data exists
    if (!order.handling || !order.handling.pickup) {
      return null;
    }

    // Check if pickup is "In-store" or "store" (POS) - if so, skip pickup phase and go straight to services
    const pickupAddr = order.handling.pickup.address?.toLowerCase() || "";
    const isStorePickup = pickupAddr === "in-store" || pickupAddr === "store";

    // STEP 1: Check if pickup is pending (unless store pickup)
    if (!isStorePickup && order.handling.pickup.status === "pending") {
      return {
        label: "Start Pickup",
        action: "start",
        type: "pickup",
      };
    }

    if (!isStorePickup && order.handling.pickup.status === "in_progress") {
      return {
        label: "Complete Pickup",
        action: "complete",
        type: "pickup",
      };
    }

    // STEP 2: If pickup is done (or store pickup), check basket services
    const services = basket.services || [];

    // Check for in-progress service
    const inProgressService = services.find(
      (s: any) => s.status === "in_progress",
    );
    if (inProgressService) {
      return {
        label: `Complete ${inProgressService.service_type.charAt(0).toUpperCase() + inProgressService.service_type.slice(1)}`,
        action: "complete",
        type: "service",
        serviceType: inProgressService.service_type,
        basketNumber: basket.basket_number,
      };
    }

    // Check for pending service - respect SERVICE_SEQUENCE order
    for (const serviceType of SERVICE_SEQUENCE) {
      const pendingService = services.find(
        (s: any) => s.service_type === serviceType && s.status === "pending",
      );
      if (pendingService) {
        return {
          label: `Start ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}`,
          action: "start",
          type: "service",
          serviceType: serviceType,
          basketNumber: basket.basket_number,
        };
      }
    }

    // STEP 3: If all services done and delivery available (and not store delivery)
    const deliveryAddr = order.handling.delivery.address?.toLowerCase() || "";
    const isStoreDelivery =
      deliveryAddr === "in-store" || deliveryAddr === "store";

    if (
      order.handling.delivery.address &&
      !isStoreDelivery &&
      order.handling.delivery.status === "pending"
    ) {
      // For multi-basket orders, only allow delivery to start when ALL baskets are ready
      const allBasketsReady = order.breakdown?.baskets?.every((b) =>
        b.services.every(
          (s) => s.status === "completed" || s.status === "skipped",
        ),
      );

      if (!allBasketsReady) {
        // Some baskets still have pending/in-progress services - can't start delivery yet
        return null;
      }

      return {
        label: "Start Delivery",
        action: "start",
        type: "delivery",
      };
    }

    if (
      order.handling.delivery.address &&
      !isStoreDelivery &&
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

  // Service status update function
  async function updateServiceStatus(
    orderId: string,
    basketNumber: number | null,
    handlingType: string | null,
    action: string,
    serviceType?: string,
  ) {
    setProcessingId(orderId);
    console.log("[UPDATE SERVICE] Starting:", {
      orderId,
      basketNumber,
      handlingType,
      action,
      serviceType,
    });

    try {
      if (serviceType && basketNumber !== null) {
        // Service status update via new endpoint
        const res = await fetch(
          `/api/orders/${orderId}/basket/${basketNumber}/service`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              service_type: serviceType,
              action: action,
            }),
          },
        );

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to update service");
        }
        console.log("[UPDATE SERVICE] Service updated successfully");
      } else {
        // Handling (pickup/delivery) update via old endpoint
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

        console.log("[UPDATE SERVICE] Calling handling endpoint with:", body);
        const res = await fetch(`/api/orders/${orderId}/serviceStatus`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const responseData = await res.json();
        console.log("[UPDATE SERVICE] Response from endpoint:", responseData);

        if (!res.ok) {
          throw new Error(responseData.error || "Failed to update service");
        }
      }

      console.log("[UPDATE SERVICE] Reloading orders...");
      await load();
      console.log("[UPDATE SERVICE] Orders reloaded successfully");
    } catch (err: any) {
      console.error("[UPDATE SERVICE] Error:", err);
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

  function printMobileOrderReceipt(order: Order) {
    // Build receipt object from mobile order data
    const receiptData: CompactReceipt = {
      orderId: order.id,
      customerName: order.customers
        ? `${order.customers.first_name} ${order.customers.last_name}`
        : "Customer",
      items: (order.breakdown?.items || []).map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
      })),
      baskets: (order.breakdown?.baskets || []).map((basket) => ({
        basket_number: basket.basket_number,
        weight_kg: basket.weight,
        subtotal: basket.total,
        // Note: services structure from DB differs from receipt interface expectations
        // Will implement conversion when needed
      })) as any,
      total: order.total_amount,
      timestamp: new Date(order.created_at).toISOString(),
      paymentMethod: order.handling?.payment_method?.toUpperCase() || "MOBILE",
      summary: order.breakdown?.summary,
    };

    // Format receipt for display
    const formattedReceipt = formatReceiptAsPlaintext(receiptData);
    setReceiptContent(formattedReceipt);
    setShowReceiptModal(true);
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
                  ? "bg-gray-100 text-gray-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("pending")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-gray-400 cursor-pointer"
              />
              <span>Pending</span>
              <span className="text-xs bg-gray-200 text-gray-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("pending")}
              </span>
            </button>

            {/* Processing Filter */}
            <button
              onClick={() => toggleStatus("processing")}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-semibold text-base transition-all ${
                selectedStatuses.includes("processing")
                  ? "bg-blue-100 text-blue-900 shadow-md hover:shadow-lg"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("processing")}
                onChange={() => {}}
                className="w-5 h-5 rounded border-2 border-blue-400 cursor-pointer"
              />
              <span>Processing</span>
              <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                {countByStatus("processing")}
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

          {/* Auto-refresh indicator */}
          <div className="text-gray-500 text-xs font-mono">
            {lastRefresh && (
              <span>
                Auto-refreshing (Last: {lastRefresh.toLocaleTimeString()})
              </span>
            )}
          </div>
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
                            ? "bg-yellow-200 text-yellow-900"
                            : order.status === "for_delivery"
                              ? "bg-violet-200 text-violet-900"
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
                  {(() => {
                    console.log(
                      "[ORDER CARD] Order",
                      order.id,
                      "handling.scheduled:",
                      order.handling?.scheduled,
                      "handling.scheduled_date:",
                      order.handling?.scheduled_date,
                    );
                    return (
                      order.handling?.scheduled &&
                      order.handling?.scheduled_date && (
                        <div className="text-xs text-blue-700 font-semibold mt-2 flex items-center gap-1">
                          <span>📅</span>
                          <span>
                            Scheduled for{" "}
                            {new Date(
                              order.handling.scheduled_date,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at {order.handling.scheduled_time || "TBD"}
                          </span>
                        </div>
                      )
                    );
                  })()}
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
                              ₱{(basket.total || 0).toFixed(2)}
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
                          {/* PICKUP - Skip if address is "In-store" or "store" (POS) */}
                          {order.handling?.pickup &&
                            order.handling.pickup.address?.toLowerCase() !==
                              "in-store" &&
                            order.handling.pickup.address?.toLowerCase() !==
                              "store" &&
                            (order.handling.pickup.status === "pending" ||
                              order.handling.pickup.status === "in_progress" ||
                              order.handling.pickup.status === "completed") && (
                              <div
                                className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                                  order.handling.pickup.status === "completed"
                                    ? "bg-green-100 text-green-900 border border-green-300"
                                    : order.handling.pickup.status ===
                                        "in_progress"
                                      ? "bg-blue-100 text-blue-900 border border-blue-300"
                                      : "bg-white text-gray-700 border border-gray-200"
                                }`}
                              >
                                <span
                                  className={`text-lg font-bold ${
                                    order.handling.pickup.status === "completed"
                                      ? "text-green-600"
                                      : order.handling.pickup.status ===
                                          "in_progress"
                                        ? "text-blue-600 animate-pulse"
                                        : "text-gray-400"
                                  }`}
                                >
                                  {order.handling.pickup.status === "completed"
                                    ? "✓"
                                    : order.handling.pickup.status ===
                                        "in_progress"
                                      ? "●"
                                      : "○"}
                                </span>
                                <span>Pickup</span>
                              </div>
                            )}

                          {/* SERVICES */}
                          {(basket.services || [])
                            .slice()
                            .sort((a: any, b: any) => {
                              const sequence = [
                                "wash",
                                "spin",
                                "dry",
                                "iron",
                                "fold",
                              ];
                              const aIndex = sequence.indexOf(a.service_type);
                              const bIndex = sequence.indexOf(b.service_type);
                              return (
                                (aIndex === -1 ? 999 : aIndex) -
                                (bIndex === -1 ? 999 : bIndex)
                              );
                            })
                            .map((service, sIdx) => {
                              const isDone =
                                service.status === "completed" ||
                                service.status === "skipped";
                              const isActive = service.status === "in_progress";

                              // Build service label with tier info
                              let serviceLabel = service.service_type
                                .split("_")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1),
                                )
                                .join(" ");

                              // Add tier info from services_data if available
                              const servicesData = basket.services_data || {};
                              if (
                                service.service_type === "wash" &&
                                servicesData.wash
                              ) {
                                const washTier = servicesData.wash;
                                if (washTier !== "off" && washTier !== true) {
                                  serviceLabel += ` (${washTier.charAt(0).toUpperCase() + washTier.slice(1)})`;
                                }
                              }
                              if (
                                service.service_type === "dry" &&
                                servicesData.dry
                              ) {
                                const dryTier = servicesData.dry;
                                if (dryTier !== "off" && dryTier !== true) {
                                  serviceLabel += ` (${dryTier.charAt(0).toUpperCase() + dryTier.slice(1)})`;
                                }
                              }

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
                                  <span className="flex-1">{serviceLabel}</span>
                                </div>
                              );
                            })}

                          {/* DELIVERY - Skip if address is "In-store" or "store" (POS) */}
                          {order.handling?.delivery?.address &&
                            order.handling.delivery.address?.toLowerCase() !==
                              "in-store" &&
                            order.handling.delivery.address?.toLowerCase() !==
                              "store" &&
                            order.handling.delivery &&
                            (order.handling.delivery.status === "pending" ||
                              order.handling.delivery.status ===
                                "in_progress" ||
                              order.handling.delivery.status ===
                                "completed") && (
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

                        {/* Service Action Button - Inside Basket */}
                        {nextAction && nextAction.type === "service" ? (
                          <button
                            onClick={() => {
                              updateServiceStatus(
                                order.id,
                                nextAction.basketNumber || basket.basket_number,
                                null,
                                nextAction.action,
                                nextAction.serviceType,
                              );
                            }}
                            disabled={processingId === order.id}
                            className="w-full mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:bg-gray-300 disabled:cursor-wait"
                          >
                            {processingId === order.id
                              ? "Processing..."
                              : nextAction.label}
                          </button>
                        ) : allServicesComplete ? (
                          <div className="text-xs text-green-700 text-center py-3 px-3 bg-green-50 rounded-lg border border-green-200 font-semibold mt-3">
                            ✓ Basket Complete
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Order-Level Action Button */}
                {order.source === "mobile" && order.status === "pending" ? (
                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => {
                        console.log("[MODAL] Opening mobile order:", {
                          orderId: order.id,
                          hasReceiptUrl: !!order.gcash_receipt_url,
                          receiptUrl: order.gcash_receipt_url,
                        });
                        setMobileOrderModal(order);
                      }}
                      disabled={processingId === order.id}
                      className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                    >
                      📸 View Screenshot
                    </button>
                  </div>
                ) : (
                  (() => {
                    const orderAction = getOrderNextAction(order);
                    return orderAction ? (
                      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button
                          onClick={() => {
                            if (orderAction.type === "pickup") {
                              updateServiceStatus(
                                order.id,
                                null,
                                "pickup",
                                orderAction.action,
                              );
                            } else if (orderAction.type === "delivery") {
                              updateServiceStatus(
                                order.id,
                                null,
                                "delivery",
                                orderAction.action,
                              );
                            }
                          }}
                          disabled={
                            processingId === order.id ||
                            (orderAction.type === "delivery" &&
                              isScheduledDeliveryInFuture(order))
                          }
                          title={
                            orderAction.type === "delivery" &&
                            isScheduledDeliveryInFuture(order)
                              ? `Scheduled for ${order.handling?.scheduled_date} at ${order.handling?.scheduled_time}`
                              : ""
                          }
                          className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            processingId === order.id
                              ? "bg-gray-300 text-gray-700 cursor-wait"
                              : orderAction.type === "delivery" &&
                                  isScheduledDeliveryInFuture(order)
                                ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                          }`}
                        >
                          {processingId === order.id
                            ? "Processing..."
                            : orderAction.type === "delivery" &&
                                isScheduledDeliveryInFuture(order)
                              ? "Not yet for Delivery"
                              : orderAction.label}
                        </button>
                      </div>
                    ) : null;
                  })()
                )}
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
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      🚚 Delivery
                    </h3>
                    <p className="text-sm text-gray-700 bg-orange-50 p-3 rounded border border-orange-200">
                      {mobileOrderModal.handling.delivery.address || "—"}
                    </p>
                  </div>

                  {/* Products List */}
                  {mobileOrderModal.breakdown?.items &&
                    mobileOrderModal.breakdown.items.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          📦 Products
                        </h3>
                        <div className="space-y-2">
                          {mobileOrderModal.breakdown.items.map(
                            (item: any, idx: number) => (
                              <div
                                key={idx}
                                className="text-sm bg-gray-50 p-2 rounded border border-gray-200"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {item.product_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {item.quantity} × ₱
                                      {(item.unit_price as number).toFixed(2)}
                                    </p>
                                  </div>
                                  <p className="font-medium text-gray-900">
                                    ₱{(item.subtotal as number).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
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
                  {(() => {
                    console.log(
                      "[MODAL RENDER] gcash_receipt_url:",
                      mobileOrderModal.gcash_receipt_url,
                    );
                    return null;
                  })()}
                  {mobileOrderModal.gcash_receipt_url ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <h3 className="font-semibold text-gray-900 mb-3 shrink-0">
                        💳 GCash Receipt
                      </h3>
                      <img
                        src={`/api/gcash-receipt/${mobileOrderModal.gcash_receipt_url.split("/").pop()}`}
                        alt="GCash Receipt"
                        className="flex-1 w-full object-contain"
                        onLoad={() => {
                          console.log("[IMG] Image loaded successfully");
                        }}
                        onError={(e) => {
                          console.log("[IMG ERROR] Image failed to load", e);
                          const img = e.target as HTMLImageElement;
                          img.src =
                            "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2245%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2216%22 font-weight=%22bold%22 fill=%22%23374151%22%3EReceipt Image%3C/text%3E%3Ctext x=%2250%25%22 y=%2255%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%236b7280%22%3EUnavailable%3C/text%3E%3C/svg%3E";
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
                  onClick={() => printMobileOrderReceipt(mobileOrderModal)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition bg-green-600 text-white hover:bg-green-700"
                  title="Print receipt"
                >
                  🖨️ Print Receipt
                </button>
                <button
                  onClick={() => {
                    setShowOrderEditor(mobileOrderModal);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition bg-orange-600 text-white hover:bg-orange-700"
                  title="Full order editor with baskets and products"
                >
                  ✏️ Modify Order
                </button>
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

        {/* Order Modification Modal (Full Editor) */}
        {showOrderEditor && (
          <OrderModificationModal
            order={showOrderEditor}
            staffId={getStaffId()}
            onClose={() => setShowOrderEditor(null)}
            onSaved={() => {
              setShowOrderEditor(null);
              setMobileOrderModal(null);
              load();
            }}
          />
        )}

        {/* Receipt Modal */}
        <ReceiptModal
          isOpen={showReceiptModal}
          receiptContent={receiptContent}
          orderId={mobileOrderModal?.id || ""}
          onClose={() => setShowReceiptModal(false)}
        />
      </div>
    </div>
  );
}
