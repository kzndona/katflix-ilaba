"use client";

import { useEffect, useState, useRef } from "react";
import { formatToPST } from "@/src/app/utils/dateUtils";

interface Order {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  handling: {
    delivery_address?: string;
    delivery_lng?: number;
    delivery_lat?: number;
  };
  customers: {
    first_name: string;
    last_name: string;
    phone_number?: string;
  } | null;
  breakdown: {
    baskets: Array<{
      basket_number: number;
      weight_kg?: number;
      services: any;
    }>;
    summary: {
      total: number;
    };
  };
}

export default function RiderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/orders/rider", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadOrders();
      setLastRefresh(new Date());
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Initialize map when order is selected
  useEffect(() => {
    if (!selectedOrder || !mapRef.current) return;

    const initializeMap = () => {
      const deliveryLocation = {
        lat: selectedOrder.handling?.delivery_lat || 14.5994,
        lng: selectedOrder.handling?.delivery_lng || 120.9842,
      };

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 14,
        center: deliveryLocation,
        mapTypeControl: true,
        fullscreenControl: true,
      });

      mapInstanceRef.current = map;

      // Add delivery marker (red)
      if (selectedOrder.handling?.delivery_lat && selectedOrder.handling?.delivery_lng) {
        new window.google.maps.Marker({
          position: deliveryLocation,
          map: map,
          title: "Delivery Location",
          icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
        });
      }

      // Add store marker (green) - center
      new window.google.maps.Marker({
        position: { lat: 14.5994, lng: 120.9842 },
        map: map,
        title: "Store (Pickup)",
        icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      });

      // Draw route if both locations exist
      if (selectedOrder.handling?.delivery_lat && selectedOrder.handling?.delivery_lng) {
        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
        });

        directionsService.route(
          {
            origin: { lat: 14.5994, lng: 120.9842 },
            destination: deliveryLocation,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (status === "OK") {
              directionsRenderer.setDirections(result);
            }
          }
        );
      }
    };

    // Wait for Google Maps to load
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };

    checkGoogleMaps();
  }, [selectedOrder]);

  const customerName = selectedOrder?.customers
    ? `${selectedOrder.customers.first_name} ${selectedOrder.customers.last_name}`
    : "Unknown";

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex gap-6">
      {/* Orders List */}
      <div className="w-96 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Rider Orders</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {orders.length} order{orders.length !== 1 ? "s" : ""} available
            {lastRefresh && (
              <span className="ml-2 text-gray-400">
                • Last: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        {/* Orders List */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No pending delivery orders
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition border-l-4 ${
                    selectedOrder?.id === order.id
                      ? "bg-blue-50 border-blue-600"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-gray-900">
                      {customerName}
                    </div>
                    <span className="text-xs font-mono text-gray-500">
                      {order.id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    📍 {order.handling?.delivery_address || "No address"}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {formatToPST(order.created_at)}
                    </span>
                    <span className="text-sm font-bold text-green-700">
                      ₱{order.total_amount.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map and Details */}
      <div className="flex-1 flex flex-col gap-6">
        {selectedOrder ? (
          <>
            {/* Map */}
            <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
              <div ref={mapRef} className="w-full h-full" />
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Order Details
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <p className="font-medium">{customerName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p className="font-medium">
                      {selectedOrder.customers?.phone_number || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Delivery Address:</span>
                    <p className="font-medium">
                      {selectedOrder.handling?.delivery_address || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Baskets:</span>
                    <p className="font-medium">
                      {selectedOrder.breakdown?.baskets?.length || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <p className="font-bold text-green-700">
                      ₱{selectedOrder.total_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedOrder.breakdown?.baskets && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Baskets</h4>
                  <div className="space-y-2">
                    {selectedOrder.breakdown.baskets.map((basket) => (
                      <div
                        key={basket.basket_number}
                        className="p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <p className="font-medium text-sm">
                          Basket #{basket.basket_number}
                        </p>
                        <p className="text-xs text-gray-600">
                          {basket.weight_kg || 0} kg
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white rounded-lg shadow flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg">Select an order to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    google: any;
  }
}
