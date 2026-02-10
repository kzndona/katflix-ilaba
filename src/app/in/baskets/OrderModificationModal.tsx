"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/app/utils/supabase/client";
import {
  Basket,
  BasketServices,
  OrderItem,
  POSProduct,
} from "@/src/app/in/pos/logic/posTypes";
import {
  buildOrderBreakdown,
  calculateBasketSubtotal,
} from "@/src/app/in/pos/logic/posHelpers";

// ============================================================================
// TYPES
// ============================================================================

// The order shape as it comes from the baskets page
interface ModalOrder {
  id: string;
  source: "pos" | "mobile";
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  handling: any;
  breakdown: {
    items: Array<any>;
    baskets: Array<{
      basket_number: number;
      weight: number;
      basket_notes: string | null;
      total: number;
      services: Array<{
        service_type: string;
        status: string;
        started_at?: string;
        completed_at?: string;
        notes?: string;
      }>;
      services_data?: Record<string, any>;
    }>;
    summary?: Record<string, any>;
  };
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string | null;
  } | null;
}

interface Props {
  order: ModalOrder;
  staffId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "baskets" | "products" | "summary";

// ============================================================================
// HELPERS: Hydrate POS Basket from order data
// ============================================================================

function hydrateBasket(orderBasket: ModalOrder["breakdown"]["baskets"][0]): Basket {
  const sd = orderBasket.services_data || {};
  const serviceTypes = orderBasket.services.map((s) => s.service_type);

  return {
    basket_number: orderBasket.basket_number,
    weight_kg: orderBasket.weight || 0,
    notes: orderBasket.basket_notes || "",
    subtotal: orderBasket.total || 0,
    services: {
      wash: sd.wash && sd.wash !== "off" ? sd.wash : serviceTypes.includes("wash") ? "basic" : "off",
      wash_cycles: sd.wash_cycles || 1,
      dry: sd.dry && sd.dry !== "off" ? sd.dry : serviceTypes.includes("dry") ? "basic" : "off",
      spin: sd.spin !== undefined ? sd.spin : serviceTypes.includes("spin"),
      iron_weight_kg: sd.iron_weight_kg || 0,
      fold: sd.fold !== undefined ? sd.fold : serviceTypes.includes("fold"),
      additional_dry_time_minutes: sd.additional_dry_time_minutes || 0,
      plastic_bags: sd.plastic_bags || 0,
      heavy_fabrics: sd.heavy_fabrics || false,
    },
  };
}

function hydrateItems(orderItems: Array<any>): OrderItem[] {
  return (orderItems || []).map((item) => ({
    product_id: item.product_id || "",
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: (item.unit_price || 0) * (item.quantity || 0),
  }));
}

const createNewBasket = (basketNumber: number): Basket => ({
  basket_number: basketNumber,
  weight_kg: 0,
  services: {
    wash: "off",
    wash_cycles: 1,
    dry: "off",
    spin: false,
    iron_weight_kg: 0,
    fold: false,
    additional_dry_time_minutes: 0,
    plastic_bags: 0,
    heavy_fabrics: false,
  },
  notes: "",
  subtotal: 0,
});

// ============================================================================
// COMPONENT
// ============================================================================

export default function OrderModificationModal({
  order,
  staffId,
  onClose,
  onSaved,
}: Props) {
  // --- Data from DB ---
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Editable state ---
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [activeBasketIndex, setActiveBasketIndex] = useState(0);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("baskets");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Load services & products from DB, hydrate state ---
  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const [servicesRes, productsRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true),
        supabase
          .from("products")
          .select("id, item_name, unit_price, quantity, image_url, reorder_level")
          .eq("is_active", true)
          .order("item_name"),
      ]);

      if (servicesRes.data) setServices(servicesRes.data);
      if (productsRes.data) {
        setProducts(
          productsRes.data.map((p: any) => ({
            id: p.id,
            item_name: p.item_name,
            unit_price: p.unit_price,
            quantity_in_stock: p.quantity,
            image_url: p.image_url,
            reorder_level: p.reorder_level,
          }))
        );
      }

      // Hydrate baskets from order
      const hydratedBaskets =
        order.breakdown?.baskets?.length > 0
          ? order.breakdown.baskets.map(hydrateBasket)
          : [createNewBasket(1)];
      setBaskets(hydratedBaskets);

      // Hydrate items
      setOrderItems(hydrateItems(order.breakdown?.items));

      setLoading(false);
    }
    init();
  }, [order]);

  // --- Service info helper (same as POS) ---
  const getServiceInfo = useCallback(
    (serviceType: string, tier?: string) => {
      const matching = services.filter((s: any) => s.service_type === serviceType);
      if (!matching.length) return { name: "", price: 0 };
      const service = matching.find((s: any) => !tier || s.tier === tier) || matching[0];
      return { name: service.name || "", price: service.base_price || 0 };
    },
    [services]
  );

  // --- Basket operations ---
  const activeBasket = baskets[activeBasketIndex] || createNewBasket(1);

  const updateService = (key: keyof BasketServices, value: any) => {
    setBaskets((prev) =>
      prev.map((b, i) =>
        i === activeBasketIndex ? { ...b, services: { ...b.services, [key]: value } } : b
      )
    );
  };

  const updateWeight = (weight: number) => {
    setBaskets((prev) => {
      const updated = [...prev];
      updated[activeBasketIndex] = { ...updated[activeBasketIndex], weight_kg: Math.min(weight, 8) };
      return updated;
    });
  };

  const updateNotes = (notes: string) => {
    setBaskets((prev) => {
      const updated = [...prev];
      updated[activeBasketIndex] = { ...updated[activeBasketIndex], notes };
      return updated;
    });
  };

  const addBasket = () => {
    const num = Math.max(...baskets.map((b) => b.basket_number), 0) + 1;
    setBaskets((prev) => [...prev, createNewBasket(num)]);
    setActiveBasketIndex(baskets.length);
  };

  const deleteBasket = (idx: number) => {
    if (baskets.length <= 1) return;
    setBaskets((prev) => prev.filter((_, i) => i !== idx));
    if (activeBasketIndex >= baskets.length - 1) {
      setActiveBasketIndex(Math.max(0, baskets.length - 2));
    }
  };

  // --- Product operations ---
  const setProductQty = (productId: string, qty: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setOrderItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.product_id !== productId);
      const existing = prev.find((i) => i.product_id === productId);
      if (existing) {
        return prev.map((i) =>
          i.product_id === productId
            ? { ...i, quantity: qty, total_price: qty * i.unit_price }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: productId,
          product_name: product.item_name,
          quantity: qty,
          unit_price: product.unit_price,
          total_price: qty * product.unit_price,
        },
      ];
    });
  };

  const getProductQty = (productId: string): number => {
    return orderItems.find((i) => i.product_id === productId)?.quantity || 0;
  };

  // --- Price calculation ---
  // Mobile orders always include staff service fee and delivery fee
  const isDelivery = !!(order.handling?.delivery?.address &&
    order.handling.delivery.address.toLowerCase() !== "in-store" &&
    order.handling.delivery.address.toLowerCase() !== "store");
  const originalDeliveryFee = order.breakdown?.summary?.delivery_fee ?? null;

  const breakdown = buildOrderBreakdown(
    baskets,
    orderItems.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
    })),
    true,            // mobile orders always have staff service
    isDelivery,      // delivery if real delivery address exists
    originalDeliveryFee, // preserve original delivery fee
    services,
    products
  );

  // --- Save ---
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/modify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breakdown: breakdown,
          modified_by: staffId,
          modified_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="text-lg font-semibold text-gray-700">Loading order editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== HEADER ===== */}
        <div className="bg-linear-to-r from-pink-50 to-rose-50 border-b border-pink-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              ✏️ Modify Order
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {order.customers?.first_name} {order.customers?.last_name} — Order #{order.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* ===== TABS ===== */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(
            [
              { key: "baskets", label: "🧺 Baskets", count: baskets.length },
              { key: "products", label: "📦 Products", count: orderItems.length },
              { key: "summary", label: "📋 Summary", count: null },
            ] as { key: Tab; label: string; count: number | null }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition border-b-2 ${
                activeTab === tab.key
                  ? "border-[#c41d7f] text-[#c41d7f] bg-rose-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== CONTENT ===== */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ---- BASKETS TAB ---- */}
          {activeTab === "baskets" && (
            <div className="space-y-4">
              {/* Basket selector strip */}
              <div className="flex items-center gap-2 flex-wrap">
                {baskets.map((b, idx) => (
                  <button
                    key={b.basket_number}
                    onClick={() => setActiveBasketIndex(idx)}
                    className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                      idx === activeBasketIndex
                        ? "bg-[#c41d7f] text-white border-[#c41d7f]"
                        : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"
                    }`}
                  >
                    Basket #{b.basket_number}
                    {baskets.length > 1 && idx === activeBasketIndex && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBasket(idx);
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-red-600"
                      >
                        ✕
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={addBasket}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition"
                >
                  + Add Basket
                </button>
              </div>

              {/* Weight — hidden from modification UI (set by staff during processing) */}

              {/* Services Grid — 2x layout matching POS */}
              <div className="grid grid-cols-2 gap-4">
                {/* LEFT: Wash, Spin, Dry */}
                <div className="space-y-3">
                  {/* Wash */}
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-1">🧺 Wash</div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: "off", label: "None", emoji: "⭕", tier: null },
                        { value: "basic", label: "Basic", emoji: "🌊", tier: "basic" },
                        { value: "premium", label: "Premium", emoji: "✨", tier: "premium" },
                      ] as const).map((opt) => {
                        const info = opt.tier ? getServiceInfo("wash", opt.tier) : { price: 0 };
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updateService("wash", opt.value)}
                            className={`p-2.5 text-xs font-semibold transition border rounded-lg flex flex-col items-center ${
                              activeBasket.services.wash === opt.value
                                ? "text-white border-[#c41d7f] bg-[#c41d7f]"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
                            }`}
                          >
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="font-bold">{opt.label}</span>
                            {opt.tier && <span>₱{info.price.toFixed(2)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Spin */}
                  {(() => {
                    const spinInfo = getServiceInfo("spin");
                    return (
                      <label className="flex items-center gap-2 p-3 border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-lg">
                        <input
                          type="checkbox"
                          checked={activeBasket.services.spin}
                          onChange={(e) => updateService("spin", e.target.checked)}
                          className="w-4 h-4 accent-[#c41d7f]"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          🌀 Spin (₱{spinInfo.price.toFixed(2)})
                        </span>
                      </label>
                    );
                  })()}

                  {/* Dry */}
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-1">💨 Dry</div>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: "off", label: "None", emoji: "⭕", tier: null },
                        { value: "basic", label: "Basic", emoji: "💨", tier: "basic" },
                        { value: "premium", label: "Premium", emoji: "🔥", tier: "premium" },
                      ] as const).map((opt) => {
                        const info = opt.tier ? getServiceInfo("dry", opt.tier) : { price: 0 };
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updateService("dry", opt.value)}
                            className={`p-2.5 text-xs font-semibold transition border rounded-lg flex flex-col items-center ${
                              activeBasket.services.dry === opt.value
                                ? "text-white border-[#c41d7f] bg-[#c41d7f]"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
                            }`}
                          >
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="font-bold">{opt.label}</span>
                            {opt.tier && <span>₱{info.price.toFixed(2)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fold */}
                  <label className="flex items-center gap-2 p-3 border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-lg">
                    <input
                      type="checkbox"
                      checked={activeBasket.services.fold}
                      onChange={(e) => updateService("fold", e.target.checked)}
                      className="w-4 h-4 accent-[#c41d7f]"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      🫧 Fold
                    </span>
                  </label>
                </div>

                {/* RIGHT: Additional Dry Time, Iron, Heavy Fabrics */}
                <div className="space-y-3">
                  {/* Additional Dry Time */}
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-1">⏱️ Extra Dry Time (₱15/8min)</div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <button
                        onClick={() => {
                          const curr = activeBasket.services.additional_dry_time_minutes;
                          if (curr > 0) updateService("additional_dry_time_minutes", curr - 8);
                        }}
                        disabled={activeBasket.services.dry === "off"}
                        className="w-9 h-9 rounded bg-gray-200 font-bold hover:bg-gray-300 disabled:opacity-40"
                      >
                        −
                      </button>
                      <div className="text-center min-w-12">
                        <div className="text-xl font-bold text-gray-900">
                          {activeBasket.services.additional_dry_time_minutes}
                        </div>
                        <div className="text-xs text-gray-500">min</div>
                      </div>
                      <button
                        onClick={() => {
                          const curr = activeBasket.services.additional_dry_time_minutes;
                          if (curr < 24) updateService("additional_dry_time_minutes", curr + 8);
                        }}
                        disabled={activeBasket.services.dry === "off"}
                        className="w-9 h-9 rounded bg-gray-200 font-bold hover:bg-gray-300 disabled:opacity-40"
                      >
                        +
                      </button>
                      <span className="text-sm text-gray-600 ml-auto">
                        ₱{((activeBasket.services.additional_dry_time_minutes / 8) * 15).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Iron */}
                  <div>
                    {(() => {
                      const ironInfo = getServiceInfo("iron");
                      return (
                        <>
                          <div className="text-sm font-bold text-gray-900 mb-1">
                            👔 Iron (₱{ironInfo.price.toFixed(2)}/kg, min 2kg)
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <button
                              onClick={() => {
                                const curr = activeBasket.services.iron_weight_kg;
                                if (curr > 0) updateService("iron_weight_kg", curr === 2 ? 0 : curr - 1);
                              }}
                              className="w-9 h-9 rounded bg-gray-200 font-bold hover:bg-gray-300"
                            >
                              −
                            </button>
                            <div className="text-center min-w-12">
                              <div className="text-xl font-bold text-gray-900">
                                {activeBasket.services.iron_weight_kg}
                              </div>
                              <div className="text-xs text-gray-500">kg</div>
                            </div>
                            <button
                              onClick={() => {
                                const curr = activeBasket.services.iron_weight_kg;
                                if (curr < 8) updateService("iron_weight_kg", curr === 0 ? 2 : (curr + 1) as any);
                              }}
                              className="w-9 h-9 rounded bg-gray-200 font-bold hover:bg-gray-300"
                            >
                              +
                            </button>
                            <span className="text-sm text-gray-600 ml-auto">
                              ₱{(activeBasket.services.iron_weight_kg * ironInfo.price).toFixed(2)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Heavy Fabrics */}
                  <label className="flex items-center gap-2 p-3 border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-lg">
                    <input
                      type="checkbox"
                      checked={activeBasket.services.heavy_fabrics}
                      onChange={(e) => updateService("heavy_fabrics", e.target.checked)}
                      className="w-4 h-4 accent-[#c41d7f]"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      👖 Heavy fabrics (jeans, comforter, etc.)
                    </span>
                  </label>

                  {/* Plastic Bags — hidden from modification UI */}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">📝 Basket Notes</label>
                <textarea
                  value={activeBasket.notes}
                  onChange={(e) => updateNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400"
                  rows={2}
                  placeholder="Any special notes for this basket..."
                />
              </div>
            </div>
          )}

          {/* ---- PRODUCTS TAB ---- */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Tap a product to add it, then adjust quantities.</p>

              {products.length === 0 ? (
                <p className="text-gray-500">No products available</p>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {products.map((p) => {
                    const qty = getProductQty(p.id);
                    const isSelected = qty > 0;
                    return (
                      <div
                        key={p.id}
                        className={`border-2 rounded-lg p-3 transition flex flex-col ${
                          isSelected
                            ? "border-[#c41d7f] bg-[#c41d7f] text-white"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {/* Image */}
                        <div
                          className={`w-full aspect-square rounded mb-2 flex items-center justify-center text-3xl overflow-hidden ${
                            isSelected ? "bg-white/20" : "bg-gray-200"
                          }`}
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.item_name} className="w-full h-full object-cover" />
                          ) : (
                            "📦"
                          )}
                        </div>

                        {/* Name/Price */}
                        <div className="flex justify-between items-start gap-1 mb-2">
                          <div>
                            <div className="font-semibold text-xs leading-tight">{p.item_name}</div>
                            <div className="text-xs">₱{p.unit_price.toFixed(2)}</div>
                          </div>
                          {isSelected && <div className="text-sm font-bold">{qty}</div>}
                        </div>

                        {/* Controls */}
                        <div className="flex justify-center gap-2 mt-auto">
                          {isSelected ? (
                            <>
                              <button
                                onClick={() => setProductQty(p.id, qty - 1)}
                                className="w-8 h-8 rounded bg-white text-gray-900 font-bold hover:bg-gray-100 flex items-center justify-center"
                              >
                                −
                              </button>
                              <button
                                onClick={() => setProductQty(p.id, qty + 1)}
                                className="w-8 h-8 rounded bg-white text-gray-900 font-bold hover:bg-gray-100 flex items-center justify-center"
                              >
                                +
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setProductQty(p.id, 1)}
                              className="w-8 h-8 rounded bg-gray-300 text-gray-700 font-bold hover:bg-gray-400 flex items-center justify-center"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- SUMMARY TAB ---- */}
          {activeTab === "summary" && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900">Order Summary (Recalculated)</h3>

              {/* Baskets */}
              {breakdown.baskets.map((b, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-gray-900">
                      Basket #{b.basket_number} — {b.weight_kg}kg
                    </span>
                    <span className="font-bold text-sm">₱{b.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {b.services.wash !== "off" && (
                      <div>Wash ({b.services.wash})</div>
                    )}
                    {b.services.spin && <div>Spin</div>}
                    {b.services.dry !== "off" && (
                      <div>Dry ({b.services.dry})</div>
                    )}
                    {b.services.iron_weight_kg > 0 && (
                      <div>Iron ({b.services.iron_weight_kg}kg)</div>
                    )}
                    {b.services.fold && <div>Fold</div>}
                    {b.services.additional_dry_time_minutes > 0 && (
                      <div>+{b.services.additional_dry_time_minutes}min dry</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Products */}
              {breakdown.items.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="font-semibold text-sm text-gray-900 mb-1">Products</div>
                  {breakdown.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-600">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <span>₱{item.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Services Subtotal</span>
                  <span>₱{breakdown.summary.subtotal_services.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Products Subtotal</span>
                  <span>₱{breakdown.summary.subtotal_products.toFixed(2)}</span>
                </div>
                {breakdown.summary.staff_service_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Staff Service Fee</span>
                    <span>₱{breakdown.summary.staff_service_fee.toFixed(2)}</span>
                  </div>
                )}
                {breakdown.summary.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee</span>
                    <span>₱{breakdown.summary.delivery_fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>VAT (12% inclusive)</span>
                  <span>₱{breakdown.summary.vat_amount.toFixed(2)}</span>
                </div>
                <div className="border-t border-pink-300 my-1"></div>
                <div className="flex justify-between font-bold text-lg">
                  <span>New Total</span>
                    <span className="text-[#c41d7f]">₱{breakdown.summary.total.toFixed(2)}</span>
                </div>
                {breakdown.summary.total !== order.total_amount && (
                  <div className="text-xs text-gray-500 text-right">
                    Previous: ₱{order.total_amount.toFixed(2)} (
                    {breakdown.summary.total > order.total_amount ? "+" : ""}
                    ₱{(breakdown.summary.total - order.total_amount).toFixed(2)})
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0 bg-white">
          {error && (
            <div className="text-sm text-red-600 font-medium flex-1">
              {error}
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-700">
              Total: <span className="text-[#c41d7f] text-lg">₱{breakdown.summary.total.toFixed(2)}</span>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                saving
                  ? "bg-gray-300 text-gray-600 cursor-wait"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {saving ? "Saving..." : "✓ Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
