"use client";

import React, { useEffect } from "react";
import { usePOSState } from "./logic/usePOSState";

/**
 * POS Page - 6-Step Clean Order Workflow
 * Functional POS interface - basket selector on left, services in grid
 */

// ============================================================================
// STEP 1: SERVICE TYPE
// ============================================================================

function Step1ServiceType({ pos }: { pos: any }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 space-y-6">
      <h2 className="text-3xl font-bold text-slate-900">Service Type</h2>

      <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
        <button
          onClick={() => pos.setServiceType("self_service")}
          className={`aspect-square p-6 rounded border-2 transition shadow-lg flex flex-col items-center justify-center text-center ${
            pos.serviceType === "self_service"
              ? "border-[#c41d7f] bg-rose-50 text-slate-900 shadow-rose-200"
              : "border-slate-300 text-slate-700 hover:border-rose-400 hover:shadow-xl"
          }`}
        >
          <div className="text-6xl mb-4">👤</div>
          <div className="font-bold text-xl text-slate-900">Self-Service</div>
          <div className="text-sm text-slate-600 mt-2">
            Customer handles laundry
          </div>
        </button>

        <button
          onClick={() => pos.setServiceType("staff_service")}
          className={`aspect-square p-6 rounded border-2 transition shadow-lg flex flex-col items-center justify-center text-center ${
            pos.serviceType === "staff_service"
              ? "border-[#c41d7f] bg-rose-50 text-slate-900 shadow-rose-200"
              : "border-slate-300 text-slate-700 hover:border-rose-400 hover:shadow-xl"
          }`}
        >
          <div className="text-6xl mb-4">👥</div>
          <div className="font-bold text-xl text-slate-900">Staff Service</div>
          <div className="text-sm text-slate-600 mt-2">+₱40.00 fee</div>
        </button>
      </div>

      <button
        onClick={() => pos.setStep(2)}
        className="text-white py-3 px-8 rounded font-semibold transition"
        style={{ backgroundColor: "#c41d7f" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#a01860")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "#c41d7f")
        }
      >
        Continue →
      </button>
    </div>
  );
}

// ============================================================================
// STEP 2: BASKET CONFIGURATION
// ============================================================================

function Step2Baskets({ pos }: { pos: any }) {
  // Helper to get service info from DB
  const getServiceInfo = (serviceType: string, tier?: string) => {
    const matching = pos.services.filter(
      (s: any) => s.service_type === serviceType,
    );
    if (!matching.length) return { name: "", price: 0, description: "" };

    const service =
      matching.find((s: any) => !tier || s.tier === tier) || matching[0];
    return {
      name: service.name || "",
      price: service.base_price || 0,
      description: service.description || "",
    };
  };

  // Helper to get additional dry time info from dry service modifiers
  const getAdditionalDryTimeInfo = () => {
    const dryService = pos.services.find((s: any) => s.service_type === "dry");
    if (!dryService)
      return {
        price_per_increment: 15,
        minutes_per_increment: 8,
        max_increments: 3,
      };

    try {
      const modifiers =
        typeof dryService.modifiers === "string"
          ? JSON.parse(dryService.modifiers)
          : dryService.modifiers;

      if (modifiers?.additional_dry_time) {
        return {
          price_per_increment:
            modifiers.additional_dry_time.price_per_increment || 15,
          minutes_per_increment:
            modifiers.additional_dry_time.minutes_per_increment || 8,
          max_increments: modifiers.additional_dry_time.max_increments || 3,
        };
      }
    } catch (e) {
      console.error("Error parsing dry service modifiers:", e);
    }

    return {
      price_per_increment: 15,
      minutes_per_increment: 8,
      max_increments: 3,
    };
  };

  if (pos.baskets.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Baskets</h2>

        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                while (pos.baskets.length < n) pos.addNewBasket();
              }}
              className="p-3 rounded font-bold text-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => pos.setStep(1)}
          className="w-full bg-slate-500 text-white py-3 rounded font-semibold hover:bg-slate-600"
        >
          ← Back
        </button>
      </div>
    );
  }

  const activeBasket = pos.baskets[pos.activeBasketIndex];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4 max-w-4xl mx-auto mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Configure Basket</h2>
        <div className="px-6 py-3 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="text-lg font-bold text-red-900">8kg per basket</div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto min-h-96">
        {/* LEFT COLUMN: Wash, Spin, Dry */}
        <div className="space-y-3">
          {/* Wash */}
          <div>
            <div className="text-sm font-bold text-slate-900 mb-2">🧺 Wash</div>
            <div className="grid grid-cols-3 gap-2 h-32">
              {[
                { value: "off", label: "None", emoji: "⭕", tier: null },
                {
                  value: "basic",
                  label: `Basic`,
                  emoji: "🌊",
                  tier: "basic",
                },
                {
                  value: "premium",
                  label: `Premium`,
                  emoji: "✨",
                  tier: "premium",
                },
              ].map((opt) => {
                const info = opt.tier
                  ? getServiceInfo("wash", opt.tier)
                  : { name: "", price: 0 };
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      pos.updateActiveBasketService?.("wash", opt.value)
                    }
                    className={`p-3 text-xs font-semibold transition border rounded-lg flex flex-col items-center justify-center ${
                      activeBasket.services?.wash === opt.value
                        ? "text-white border-[#c41d7f] bg-[#c41d7f]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                    }`}
                  >
                    <div className="text-lg mb-1">{opt.emoji}</div>
                    <div className="font-bold">{opt.label}</div>
                    <div>₱{info.price.toFixed(2)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spin */}
          <div>
            {(() => {
              const spinInfo = getServiceInfo("spin");
              return (
                <label className="flex items-center gap-2 p-3 border border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 rounded-lg h-20">
                  <input
                    type="checkbox"
                    checked={activeBasket.services?.spin || false}
                    onChange={(e) =>
                      pos.updateActiveBasketService?.("spin", e.target.checked)
                    }
                    className="w-4 h-4 accent-[#c41d7f]"
                  />
                  <div className="text-sm font-semibold text-slate-700">
                    🌀 Spin (₱{spinInfo.price.toFixed(2)})
                  </div>
                </label>
              );
            })()}
          </div>

          {/* Dry */}
          <div>
            <div className="text-sm font-bold text-slate-900 mb-2">💨 Dry</div>
            <div className="grid grid-cols-3 gap-2 h-32">
              {[
                { value: "off", label: "None", emoji: "⭕", tier: null },
                {
                  value: "basic",
                  label: "Basic",
                  emoji: "💨",
                  tier: "basic",
                },
                {
                  value: "premium",
                  label: "Premium",
                  emoji: "🔥",
                  tier: "premium",
                },
              ].map((opt) => {
                const info = opt.tier
                  ? getServiceInfo("dry", opt.tier)
                  : { name: "", price: 0 };
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      pos.updateActiveBasketService?.("dry", opt.value)
                    }
                    className={`p-3 text-xs font-semibold transition border rounded-lg flex flex-col items-center justify-center ${
                      activeBasket.services?.dry === opt.value
                        ? "text-white border-[#c41d7f] bg-[#c41d7f]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                    }`}
                  >
                    <div className="text-lg mb-1">{opt.emoji}</div>
                    <div className="font-bold">{opt.label}</div>
                    <div>₱{info.price.toFixed(2)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Additional Dry Time, Iron, Plastic Bags */}
        <div className="space-y-3 flex flex-col">
          {/* Additional Dry Time */}
          <div className="flex-1 flex flex-col">
            {(() => {
              const dryTimeInfo = getAdditionalDryTimeInfo();
              const price = dryTimeInfo.price_per_increment;
              const minutes = dryTimeInfo.minutes_per_increment;
              return (
                <>
                  <div className="text-sm font-bold text-slate-900 mb-2">
                    ⏱️ Additional Dry Time @ ₱{price.toFixed(2)}/{minutes}min
                  </div>
                  <div className="p-3 border rounded-lg flex items-center justify-center gap-4 bg-slate-100 border-slate-300 flex-1">
                    <div className="text-center min-w-16">
                      <div className="text-2xl font-bold text-slate-900">
                        {activeBasket.services?.additionalDryMinutes || 0}
                      </div>
                      <div className="text-xs text-slate-600">min</div>
                    </div>
                    <div className="text-center min-w-20 border-l border-slate-300 pl-4">
                      <div className="text-sm font-semibold text-slate-700">
                        ₱
                        {(
                          ((activeBasket.services?.additionalDryMinutes || 0) /
                            minutes) *
                          price
                        ).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-2 border-l border-slate-300 pl-4 h-full">
                      <button
                        onClick={() => {
                          if (activeBasket.services?.dry !== "off") {
                            const curr =
                              activeBasket.services?.additionalDryMinutes || 0;
                            if (curr > 0)
                              pos.updateActiveBasketService?.(
                                "additionalDryMinutes",
                                curr - minutes,
                              );
                          }
                        }}
                        disabled={activeBasket.services?.dry === "off"}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          if (activeBasket.services?.dry !== "off") {
                            const curr =
                              activeBasket.services?.additionalDryMinutes || 0;
                            const maxMinutes =
                              minutes * dryTimeInfo.max_increments;
                            if (curr < maxMinutes)
                              pos.updateActiveBasketService?.(
                                "additionalDryMinutes",
                                curr + minutes,
                              );
                          }
                        }}
                        disabled={activeBasket.services?.dry === "off"}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Iron */}
          <div className="flex-1 flex flex-col">
            {(() => {
              const ironInfo = getServiceInfo("iron");
              return (
                <>
                  <div className="text-sm font-bold text-slate-900 mb-2">
                    👔 Iron Service @ ₱{ironInfo.price.toFixed(2)}/kg
                  </div>
                  <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center gap-4 flex-1">
                    <div className="text-center min-w-16">
                      <div className="text-2xl font-bold text-slate-900">
                        {activeBasket.services?.iron_weight_kg || 0}
                      </div>
                      <div className="text-xs text-slate-600">kg</div>
                    </div>
                    <div className="text-center min-w-20 border-l border-slate-300 pl-4">
                      <div className="text-sm font-semibold text-slate-700">
                        ₱
                        {(
                          (activeBasket.services?.iron_weight_kg || 0) *
                          ironInfo.price
                        ).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-2 border-l border-slate-300 pl-4 h-full">
                      <button
                        onClick={() => {
                          const curr =
                            activeBasket.services?.iron_weight_kg || 0;
                          if (curr > 0) {
                            const newVal = curr === 2 ? 0 : curr - 1;
                            pos.updateActiveBasketService?.(
                              "iron_weight_kg",
                              newVal,
                            );
                          }
                        }}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 font-bold text-sm rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          const curr =
                            activeBasket.services?.iron_weight_kg || 0;
                          if (curr < 8) {
                            const newVal = curr === 0 ? 2 : curr + 1;
                            pos.updateActiveBasketService?.(
                              "iron_weight_kg",
                              newVal,
                            );
                          }
                        }}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 font-bold text-sm rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Plastic Bags */}
          <div className="flex-1 flex flex-col">
            {(() => {
              // Get plastic bags from products (it should be a product item)
              const plasticBagProduct = pos.products.find(
                (p: any) =>
                  p.item_name.toLowerCase().includes("bag") ||
                  p.item_name.toLowerCase().includes("plastic"),
              );
              const bagPrice = plasticBagProduct?.unit_price || 5;
              return (
                <>
                  <div className="text-sm font-bold text-slate-900 mb-2">
                    🛍️ Plastic Bags @ ₱{bagPrice.toFixed(2)}/pc
                  </div>
                  <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center gap-4 flex-1">
                    <div className="text-center min-w-16">
                      <div className="text-2xl font-bold text-slate-900">
                        {activeBasket.services?.plastic_bags || 0}
                      </div>
                      <div className="text-xs text-slate-600">pc</div>
                    </div>
                    <div className="text-center min-w-20 border-l border-slate-300 pl-4">
                      <div className="text-sm font-semibold text-slate-700">
                        ₱
                        {(
                          (activeBasket.services?.plastic_bags || 0) * bagPrice
                        ).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-2 border-l border-slate-300 pl-4 h-full">
                      <button
                        onClick={() => {
                          const curr = activeBasket.services?.plastic_bags || 0;
                          if (curr > 0)
                            pos.updateActiveBasketService?.(
                              "plastic_bags",
                              curr - 1,
                            );
                        }}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 font-bold text-sm rounded flex items-center justify-center"
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          const curr = activeBasket.services?.plastic_bags || 0;
                          pos.updateActiveBasketService?.(
                            "plastic_bags",
                            curr + 1,
                          );
                        }}
                        className="h-full aspect-square min-w-0 bg-slate-300 text-slate-700 hover:bg-slate-400 font-bold text-sm rounded flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Buttons - Same width as container */}
      <div className="max-w-4xl mx-auto flex gap-2 pt-2"></div>
    </div>
  );
}

// ============================================================================
// STEP 3: PRODUCTS
// ============================================================================

function Step3Products({ pos }: { pos: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Products</h2>

      {pos.products.length === 0 ? (
        <p className="text-slate-600">No products available</p>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          {pos.products.map((p: any) => (
            <div
              key={p.id}
              className={`aspect-square border-2 rounded-lg p-3 transition flex flex-col ${
                pos.selectedProducts[p.id]
                  ? "border-[#c41d7f] bg-[#c41d7f] text-white"
                  : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {/* Image Placeholder */}
              <div
                className={`w-full flex-1 rounded mb-2 flex items-center justify-center text-3xl font-semibold ${
                  pos.selectedProducts[p.id]
                    ? "bg-white bg-opacity-20 text-white"
                    : "bg-slate-300 text-slate-600"
                }`}
              >
                📦
              </div>

              {/* Name | Quantity (horizontal) */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex flex-col flex-1">
                  <div className="font-semibold text-xs leading-tight">
                    {p.item_name}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      pos.selectedProducts[p.id]
                        ? "text-white"
                        : "text-slate-600"
                    }`}
                  >
                    ₱{(p.unit_price || 0).toFixed(2)}
                  </div>
                </div>
                {pos.selectedProducts[p.id] && (
                  <div className="text-sm font-bold">
                    {pos.selectedProducts[p.id]}
                  </div>
                )}
              </div>

              {/* Buttons (horizontal, centered) */}
              <div className="flex justify-center gap-2 mt-auto">
                {pos.selectedProducts[p.id] ? (
                  <>
                    <button
                      onClick={() =>
                        pos.setProductQuantity(
                          p.id,
                          pos.selectedProducts[p.id] - 1,
                        )
                      }
                      className="w-8 h-8 rounded bg-white text-slate-900 font-bold hover:bg-opacity-90 flex items-center justify-center"
                    >
                      −
                    </button>
                    <button
                      onClick={() =>
                        pos.setProductQuantity(
                          p.id,
                          pos.selectedProducts[p.id] + 1,
                        )
                      }
                      className="w-8 h-8 rounded bg-white text-slate-900 font-bold hover:bg-opacity-90 flex items-center justify-center"
                    >
                      +
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => pos.setProductQuantity(p.id, 1)}
                    className="w-8 h-8 rounded bg-slate-300 text-slate-700 font-bold hover:bg-slate-400 flex items-center justify-center"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP 4: CUSTOMER
// ============================================================================

function Step4Customer({ pos }: { pos: any }) {
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState("");
  const [editedPhone, setEditedPhone] = React.useState("");
  const [editedEmail, setEditedEmail] = React.useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);

  const validateAndCreate = async () => {
    setError("");
    const firstName = pos.newCustomerForm.first_name?.trim();
    const lastName = pos.newCustomerForm.last_name?.trim();
    const phone = pos.newCustomerForm.phone_number?.trim();

    if (!firstName) {
      setError("First name is required");
      return;
    }
    if (!lastName) {
      setError("Last name is required");
      return;
    }
    if (!phone) {
      setError("Phone number is required");
      return;
    }

    setIsCreatingCustomer(true);
    try {
      // Create customer via API (will trigger email if email provided)
      const response = await fetch("/api/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          email_address: pos.newCustomerForm.email_address || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to create customer");
        return;
      }

      const data = await response.json();
      if (data.success && data.customer) {
        // Send invitation email if email provided
        if (pos.newCustomerForm.email_address) {
          await fetch("/api/email/send-invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: data.customer.id,
              email: data.customer.email_address,
              first_name: data.customer.first_name,
            }),
          }).catch((err) => console.error("Email invitation failed:", err));
        }

        // Select the newly created customer
        pos.selectCustomer({
          id: data.customer.id,
          first_name: data.customer.first_name,
          last_name: data.customer.last_name,
          phone_number: data.customer.phone_number,
          email_address: data.customer.email_address,
          loyalty_points: 0,
        });

        setError("");
        setEditedPhone("");
        setEditedEmail("");
      }
    } catch (err) {
      console.error("Customer creation error:", err);
      setError("Failed to create customer");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleChangeCustomer = () => {
    setEditedPhone("");
    setEditedEmail("");
    setError("");
    pos.clearCustomer();
  };

  return (
    <div className="space-y-4 w-full">
      <h2 className="text-2xl font-bold text-slate-900">Customer</h2>

      {/* Search field */}
      <input
        type="text"
        placeholder="Search customer..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          pos.setCustomerSearch(e.target.value);
        }}
        className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm"
      />

      {pos.customerSuggestions.length > 0 && (
        <div className="border border-slate-300 rounded-lg max-h-40 overflow-y-auto">
          {pos.customerSuggestions.map((c: any) => (
            <button
              key={c.id}
              onClick={() => {
                pos.selectCustomer(c);
                setSearch("");
                setError("");
                setEditedPhone("");
                setEditedEmail("");
              }}
              className="w-full text-left p-3 border-b border-slate-200 hover:bg-slate-50 text-sm"
            >
              <div className="font-semibold text-slate-900">
                {c.first_name} {c.last_name}
              </div>
              <div className="text-xs text-slate-600">{c.phone_number}</div>
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t-2 border-slate-300"></div>

      {/* Customer form fields - always visible */}
      <div className="space-y-3 bg-slate-50 border-2 border-slate-300 rounded-lg p-4">
        {/* First Name | Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="First Name"
            value={
              pos.customer
                ? pos.customer.first_name
                : pos.newCustomerForm.first_name
            }
            onChange={(e) => {
              if (!pos.customer) {
                const value = e.target.value.replace(/[0-9]/g, "");
                pos.setNewCustomerForm({
                  ...pos.newCustomerForm,
                  first_name: value,
                });
                setError("");
              }
            }}
            disabled={!!pos.customer}
            className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm disabled:bg-slate-200 disabled:cursor-not-allowed"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={
              pos.customer
                ? pos.customer.last_name
                : pos.newCustomerForm.last_name
            }
            onChange={(e) => {
              if (!pos.customer) {
                const value = e.target.value.replace(/[0-9]/g, "");
                pos.setNewCustomerForm({
                  ...pos.newCustomerForm,
                  last_name: value,
                });
                setError("");
              }
            }}
            disabled={!!pos.customer}
            className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm disabled:bg-slate-200 disabled:cursor-not-allowed"
          />
        </div>

        {/* Phone | Email - NOTE: Edits to existing customer are local only, NOT saved to DB */}
        <div className="grid grid-cols-2 gap-3">
          <input
            type="tel"
            placeholder="Phone"
            value={
              editedPhone ||
              (pos.customer
                ? pos.customer.phone_number
                : pos.newCustomerForm.phone_number)
            }
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9+]/g, "");
              if (pos.customer) {
                // For existing customer, only update local state (not saved to DB)
                setEditedPhone(val);
              } else {
                // For new customer, update form state
                pos.setNewCustomerForm({
                  ...pos.newCustomerForm,
                  phone_number: val,
                });
              }
              setError("");
            }}
            className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={
              editedEmail ||
              (pos.customer
                ? pos.customer.email || ""
                : pos.newCustomerForm.email_address)
            }
            onChange={(e) => {
              const val = e.target.value;
              if (pos.customer) {
                // For existing customer, only update local state (not saved to DB)
                setEditedEmail(val);
              } else {
                // For new customer, update form state
                pos.setNewCustomerForm({
                  ...pos.newCustomerForm,
                  email_address: val,
                });
              }
            }}
            className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm"
          />
        </div>

        {error && (
          <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700 font-semibold">
            {error}
          </div>
        )}

        {pos.customer ? (
          <div className="space-y-2">
            <div className="p-2 bg-blue-50 border border-blue-300 rounded text-xs text-blue-700">
              ℹ️ Phone and email edits are not saved to database
            </div>
            <button
              onClick={handleChangeCustomer}
              className="w-full text-red-700 border-2 border-red-700 px-4 py-3 rounded-lg font-semibold hover:bg-red-50 transition"
            >
              Change Customer
            </button>
          </div>
        ) : (
          <button
            onClick={validateAndCreate}
            disabled={isCreatingCustomer}
            style={{ backgroundColor: "#c41d7f" }}
            className="w-full text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingCustomer ? "Creating..." : "New Customer Record"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 5: HANDLING
// ============================================================================

function Step5Handling({ pos }: { pos: any }) {
  // Get delivery fee from services table
  const getDeliveryFeeDefault = () => {
    const deliveryService = pos.services.find(
      (s: any) => s.service_type === "delivery",
    );
    return deliveryService?.base_price || 50;
  };

  const deliveryFeeDefault = getDeliveryFeeDefault();

  return (
    <div className="space-y-4 w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold text-slate-900">Handling</h2>

      {/* Handling type buttons - square options */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
        <button
          onClick={() => pos.setDeliveryType("pickup")}
          className={`aspect-square border-2 rounded-lg p-4 transition flex flex-col items-center justify-center text-center ${
            pos.deliveryType === "pickup"
              ? "border-[#c41d7f] bg-[#c41d7f] text-white"
              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <div className="text-3xl mb-2">🏪</div>
          <div className="font-bold text-sm">In-store</div>
        </button>

        <button
          onClick={() => pos.setDeliveryType("delivery")}
          className={`aspect-square border-2 rounded-lg p-4 transition flex flex-col items-center justify-center text-center ${
            pos.deliveryType === "delivery"
              ? "border-[#c41d7f] bg-[#c41d7f] text-white"
              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <div className="text-3xl mb-2">🚚</div>
          <div className="font-bold text-sm">Deliver to customer</div>
          <div className="text-xs mt-1">
            +₱{(pos.deliveryFeeOverride || deliveryFeeDefault).toFixed(2)}
          </div>
        </button>
      </div>

      {/* Delivery details when delivery is selected */}
      {pos.deliveryType === "delivery" && (
        <div className="space-y-3 bg-slate-50 border-2 border-slate-300 rounded-lg p-4 w-full">
          <input
            type="text"
            placeholder="Address"
            value={pos.deliveryAddress}
            onChange={(e) => pos.setDeliveryAddress(e.target.value)}
            className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm"
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Delivery Fee (minimum ₱{deliveryFeeDefault.toFixed(2)})
            </label>
            <input
              type="number"
              placeholder="Fee"
              step="0.01"
              min={deliveryFeeDefault}
              value={(pos.deliveryFeeOverride || deliveryFeeDefault).toFixed(2)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || deliveryFeeDefault;
                // Enforce minimum delivery fee
                const finalVal = Math.max(val, deliveryFeeDefault);
                pos.setDeliveryFeeOverride(finalVal);
              }}
              className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <textarea
        placeholder="Notes (optional)"
        value={pos.specialInstructions}
        onChange={(e) => pos.setSpecialInstructions(e.target.value)}
        className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm h-24 resize-none"
      />
    </div>
  );
}

// ============================================================================
// STEP 6: PAYMENT
// ============================================================================

function Step6Receipt({ pos }: { pos: any }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-900">Review Order</h2>
      <p className="text-slate-600">
        Review your order in the sidebar and proceed to checkout.
      </p>
    </div>
  );
}

// ============================================================================
// ORDER SUMMARY SIDEBAR
// ============================================================================

function OrderSummary({
  pos,
  keypadFocus,
  setKeypadFocus,
}: {
  pos: any;
  keypadFocus: string | null;
  setKeypadFocus: any;
}) {
  const breakdown = pos.calculateOrderTotal();
  const steps = ["Service", "Baskets", "Products", "Customer", "Handling"];

  // Helper to get service info from DB
  const getServiceInfo = (serviceType: string, tier?: string) => {
    const matching = pos.services.filter(
      (s: any) => s.service_type === serviceType,
    );
    if (!matching.length) return { name: "", price: 0, description: "" };

    const service =
      matching.find((s: any) => !tier || s.tier === tier) || matching[0];
    return {
      name: service.name || "",
      price: service.base_price || 0,
      description: service.description || "",
    };
  };

  // Helper to get additional dry time info from dry service modifiers
  const getAdditionalDryTimeInfo = () => {
    const dryService = pos.services.find((s: any) => s.service_type === "dry");
    if (!dryService)
      return {
        price_per_increment: 15,
        minutes_per_increment: 8,
        max_increments: 3,
      };

    try {
      const modifiers =
        typeof dryService.modifiers === "string"
          ? JSON.parse(dryService.modifiers)
          : dryService.modifiers;

      if (modifiers?.additional_dry_time) {
        return {
          price_per_increment:
            modifiers.additional_dry_time.price_per_increment || 15,
          minutes_per_increment:
            modifiers.additional_dry_time.minutes_per_increment || 8,
          max_increments: modifiers.additional_dry_time.max_increments || 3,
        };
      }
    } catch (e) {
      console.error("Error parsing dry service modifiers:", e);
    }

    return {
      price_per_increment: 15,
      minutes_per_increment: 8,
      max_increments: 3,
    };
  };

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Scrollable top section - Order breakdown */}
      <div className="space-y-3 text-sm flex-1 overflow-y-auto">
        <div className="font-bold text-slate-900 border-b border-slate-300 pb-2">
          {steps[pos.step - 1]} ({pos.step}/5)
        </div>

        {pos.customer && (
          <div className="bg-slate-100 border border-slate-300 rounded p-2">
            <div className="text-xs text-slate-600 font-semibold uppercase">
              Customer
            </div>
            <div className="font-semibold text-slate-900">
              {pos.customer.first_name} {pos.customer.last_name}
            </div>
          </div>
        )}

        {breakdown.baskets.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600 font-semibold uppercase">
              Baskets
            </div>
            {breakdown.baskets.map((b: any, i: number) => {
              const basket = pos.baskets[i];
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Basket {i + 1}</span>
                    <span>₱{b.subtotal.toFixed(2)}</span>
                  </div>
                  {basket?.services && (
                    <>
                      {basket.services.wash &&
                        basket.services.wash !== "off" && (
                          <div className="flex justify-between text-xs ml-3 text-slate-600">
                            <span>🧺 Wash ({basket.services.wash})</span>
                            <span className="font-semibold">
                              ₱
                              {getServiceInfo(
                                "wash",
                                basket.services.wash,
                              ).price.toFixed(2)}
                            </span>
                          </div>
                        )}
                      {basket.services.spin && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>🌀 Spin</span>
                          <span className="font-semibold">
                            ₱{getServiceInfo("spin").price.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {basket.services.dry && basket.services.dry !== "off" && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>💨 Dry ({basket.services.dry})</span>
                          <span className="font-semibold">
                            ₱
                            {getServiceInfo(
                              "dry",
                              basket.services.dry,
                            ).price.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(basket.services.additionalDryMinutes || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>
                            ⏱️ Extra Dry ({basket.services.additionalDryMinutes}
                            m)
                          </span>
                          <span className="font-semibold">
                            ₱
                            {(
                              ((basket.services.additionalDryMinutes || 0) /
                                getAdditionalDryTimeInfo()
                                  .minutes_per_increment) *
                              getAdditionalDryTimeInfo().price_per_increment
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(basket.services.iron_weight_kg || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>
                            👔 Iron ({basket.services.iron_weight_kg}kg)
                          </span>
                          <span className="font-semibold">
                            ₱
                            {(
                              (basket.services.iron_weight_kg || 0) *
                              getServiceInfo("iron").price
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(basket.services.plastic_bags || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>
                            🛍️ Bags ({basket.services.plastic_bags}pc)
                          </span>
                          <span className="font-semibold">
                            ₱
                            {(
                              (basket.services.plastic_bags || 0) *
                              getServiceInfo("plastic_bags").price
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {Object.keys(pos.selectedProducts).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-slate-600 font-semibold uppercase">
              Products
            </div>
            {Object.entries(pos.selectedProducts).map(
              ([productId, qty]: any) => {
                const product = pos.products.find(
                  (p: any) => p.id === productId,
                );
                return (
                  <div key={productId} className="flex justify-between text-xs">
                    <span>{product?.item_name || "Unknown Product"}</span>
                    <span className="font-semibold">
                      ₱{((product?.unit_price || 0) * qty).toFixed(2)}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom section - Summary fees and Payment and Checkout */}
      <div className="border-t border-slate-300 pt-2 space-y-2 text-xs shrink-0">
        {breakdown.summary.subtotal_products > 0 && (
          <div className="flex justify-between">
            <span>Products</span>
            <span>₱{breakdown.summary.subtotal_products.toFixed(2)}</span>
          </div>
        )}
        {breakdown.summary.subtotal_services > 0 && (
          <div className="flex justify-between">
            <span>Services</span>
            <span>₱{breakdown.summary.subtotal_services.toFixed(2)}</span>
          </div>
        )}
        {breakdown.summary.staff_service_fee > 0 && (
          <div className="flex justify-between">
            <span>Staff Fee</span>
            <span>₱{breakdown.summary.staff_service_fee.toFixed(2)}</span>
          </div>
        )}
        {breakdown.summary.delivery_fee > 0 && (
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>₱{breakdown.summary.delivery_fee.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-slate-900">
          <span>VAT (12%)</span>
          <span>₱{breakdown.summary.vat_amount.toFixed(2)}</span>
        </div>

        {/* LOYALTY POINTS SECTION */}
        {pos.customer && (pos.customer.loyalty_points || 0) > 0 && (
          <div className="border border-[#c41d7f] rounded p-2 bg-pink-50 space-y-2">
            <div className="text-xs text-slate-600 font-semibold uppercase">
              💎 Loyalty Points: {pos.customer.loyalty_points || 0} pts
            </div>
            
            {/* Tier 1: 10 points for 5% discount */}
            {(pos.customer.loyalty_points || 0) >= 10 && (
              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-pink-100 border border-pink-200">
                <input
                  type="radio"
                  name="loyaltyTier"
                  checked={pos.loyaltyDiscountTier === 'tier1'}
                  onChange={() => pos.setLoyaltyDiscountTier('tier1')}
                  className="w-4 h-4 accent-[#c41d7f] rounded mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-900">10 pts → 5% OFF</div>
                  <div className="text-slate-600">Save ₱{(breakdown.summary.total * 0.05).toFixed(2)}</div>
                </div>
              </label>
            )}
            
            {/* Tier 2: 20 points for 15% discount */}
            {(pos.customer.loyalty_points || 0) >= 20 && (
              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-pink-100 border border-pink-200">
                <input
                  type="radio"
                  name="loyaltyTier"
                  checked={pos.loyaltyDiscountTier === 'tier2'}
                  onChange={() => pos.setLoyaltyDiscountTier('tier2')}
                  className="w-4 h-4 accent-[#c41d7f] rounded mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-900">20 pts → 15% OFF</div>
                  <div className="text-slate-600">Save ₱{(breakdown.summary.total * 0.15).toFixed(2)}</div>
                </div>
              </label>
            )}
            
            {/* No discount option */}
            <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-pink-100 border border-pink-200">
              <input
                type="radio"
                name="loyaltyTier"
                checked={pos.loyaltyDiscountTier === null}
                onChange={() => pos.setLoyaltyDiscountTier(null)}
                className="w-4 h-4 accent-[#c41d7f] rounded"
              />
              <span className="text-xs font-semibold text-slate-700">
                Don't use loyalty points
              </span>
            </label>
          </div>
        )}

        {pos.loyaltyDiscountTier && pos.customer && (
          <div className="flex justify-between text-amber-700 font-semibold text-sm">
            <span>Loyalty Discount</span>
            <span>-₱{(pos.loyaltyDiscountTier === 'tier1' ? breakdown.summary.total * 0.05 : breakdown.summary.total * 0.15).toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-base text-amber-700 bg-slate-100 rounded px-2 py-1">
          <span>TOTAL</span>
          <span>₱{(() => {
            let discountPercent = 0;
            if (pos.loyaltyDiscountTier === 'tier1') discountPercent = 0.05;
            if (pos.loyaltyDiscountTier === 'tier2') discountPercent = 0.15;
            const totalAmount = pos.customer && pos.loyaltyDiscountTier ? breakdown.summary.total * (1 - discountPercent) : breakdown.summary.total;
            return totalAmount.toFixed(2);
          })()}</span>
        </div>

        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
          Payment
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment"
              checked={pos.paymentMethod === "cash"}
              onChange={() => pos.setPaymentMethod("cash")}
              className="w-4 h-4 accent-[#c41d7f]"
            />
            <span className="text-sm font-semibold text-slate-900">
              💵 Cash
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment"
              checked={pos.paymentMethod === "gcash"}
              onChange={() => pos.setPaymentMethod("gcash")}
              className="w-4 h-4 accent-[#c41d7f]"
            />
            <span className="text-sm font-semibold text-slate-900">
              💳 GCash
            </span>
          </label>
        </div>

        {pos.paymentMethod === "cash" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">
              Amount Paid
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={pos.amountPaid || ""}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  pos.setAmountPaid(val);
                } else if (e.target.value === "") {
                  pos.setAmountPaid(0);
                }
              }}
              onFocus={() => setKeypadFocus("amount")}
              onBlur={() => setKeypadFocus(null)}
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm"
            />
            {pos.amountPaid > 0 && (() => {
              let discountPercent = 0;
              if (pos.loyaltyDiscountTier === 'tier1') discountPercent = 0.05;
              if (pos.loyaltyDiscountTier === 'tier2') discountPercent = 0.15;
              const totalAmount = pos.customer && pos.loyaltyDiscountTier ? breakdown.summary.total * (1 - discountPercent) : breakdown.summary.total;
              return pos.amountPaid >= totalAmount ? (
                <div className="p-2 bg-slate-100 rounded text-xs font-semibold text-slate-900">
                  Change: ₱
                  {Math.max(
                    0,
                    pos.amountPaid - totalAmount,
                  ).toFixed(2)}
                </div>
              ) : null;
            })()}
          </div>
        )}

        {pos.paymentMethod === "gcash" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">
              GCash Reference
            </label>
            <input
              type="text"
              placeholder="Reference number"
              value={pos.gcashReference || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9\-]/g, "");
                pos.setGcashReference(val);
              }}
              onFocus={() => setKeypadFocus("gcash")}
              onBlur={() => setKeypadFocus(null)}
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Keypad */}
        <div className="border-t border-slate-300 pt-3 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => {
                  if (pos.paymentMethod === "cash") {
                    pos.setAmountPaid((pos.amountPaid || 0) * 10 + num);
                  } else if (pos.paymentMethod === "gcash") {
                    pos.setGcashReference((pos.gcashReference || "") + num);
                  }
                }}
                className="py-2 bg-slate-200 hover:bg-slate-300 rounded font-bold"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => {
                if (pos.paymentMethod === "cash") {
                  const current = pos.amountPaid || 0;
                  if (!current.toString().includes(".")) {
                    pos.setAmountPaid(Math.floor(current) + 0.01);
                  }
                }
              }}
              className="py-2 bg-slate-200 hover:bg-slate-300 rounded font-bold"
            >
              .
            </button>
            <button
              onClick={() => {
                if (pos.paymentMethod === "cash") {
                  pos.setAmountPaid((pos.amountPaid || 0) * 10);
                } else if (pos.paymentMethod === "gcash") {
                  pos.setGcashReference((pos.gcashReference || "") + "0");
                }
              }}
              className="py-2 bg-slate-200 hover:bg-slate-300 rounded font-bold"
            >
              0
            </button>
            <button
              onClick={() => {
                if (pos.paymentMethod === "cash") {
                  pos.setAmountPaid(Math.floor((pos.amountPaid || 0) / 10));
                } else if (pos.paymentMethod === "gcash") {
                  const ref = pos.gcashReference || "";
                  pos.setGcashReference(ref.slice(0, -1));
                }
              }}
              className="py-2 bg-red-400 hover:bg-red-500 text-white rounded font-bold"
            >
              ←
            </button>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={() => pos.createOrder()}
          disabled={pos.isProcessing || !pos.isPaymentValid()}
          style={{ backgroundColor: "#c41d7f" }}
          className="w-full mt-4 text-white py-3 rounded-lg font-bold hover:opacity-90 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {pos.isProcessing ? "Processing..." : "Checkout"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE - POS LAYOUT
// ============================================================================

export default function POSPage() {
  const pos = usePOSState();
  const [mounted, setMounted] = React.useState(false);
  const [keypadFocus, setKeypadFocus] = React.useState<
    "amount" | "gcash" | null
  >(null);

  useEffect(() => {
    setMounted(true);
    if (pos.step === 0) pos.setStep(1);
  }, []);

  if (!mounted) return null;

  const currentStep = Math.max(1, Math.min(5, pos.step || 1));
  const steps = [
    <Step1ServiceType pos={pos} />,
    <Step2Baskets pos={pos} />,
    <Step3Products pos={pos} />,
    <Step4Customer pos={pos} />,
    <Step5Handling pos={pos} />,
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* LEFT: Sidebar - Steps & Baskets */}
      {currentStep >= 2 && (
        <div className="w-48 bg-slate-800 text-slate-50 border-r border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Step Navigation Tabs */}
          <div className="space-y-2 pb-4 border-b border-slate-700">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Steps
            </div>
            {[
              { num: 1, label: "Service" },
              { num: 2, label: "Baskets" },
              { num: 3, label: "Products" },
              { num: 4, label: "Customer" },
              { num: 5, label: "Handling" },
            ].map((step) => (
              <button
                key={step.num}
                onClick={() => pos.setStep(step.num as any)}
                className={`w-full px-3 py-2 text-sm font-bold rounded-lg transition text-left ${
                  currentStep === step.num
                    ? "text-white rounded-lg"
                    : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
                style={
                  currentStep === step.num ? { backgroundColor: "#c41d7f" } : {}
                }
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Add/Remove Basket Buttons */}
          <div className="space-y-2 pb-4 border-b border-slate-700">
            <button
              onClick={() => pos.addNewBasket?.()}
              className="w-full px-3 py-2 text-sm font-bold bg-slate-600 text-white hover:bg-slate-500 rounded-lg transition"
            >
              + Add Basket
            </button>
            {pos.baskets.length > 1 && (
              <button
                onClick={() => pos.deleteBasket?.(pos.activeBasketIndex)}
                className="w-full px-3 py-2 text-sm font-bold bg-slate-600 text-white hover:bg-slate-500 rounded-lg transition"
              >
                Remove Basket
              </button>
            )}
          </div>

          {/* Basket List */}
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Baskets
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {pos.baskets.map((b: any, idx: number) => (
              <button
                key={idx}
                onClick={() => pos.setActiveBasketIndex?.(idx)}
                className={`w-full px-3 py-2 text-sm font-bold rounded-lg transition ${
                  pos.activeBasketIndex === idx
                    ? "text-white rounded-lg"
                    : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
                style={
                  pos.activeBasketIndex === idx
                    ? { backgroundColor: "#c41d7f" }
                    : {}
                }
              >
                Basket #{b.basket_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CENTER: Main Content - Centered */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="w-full max-w-5xl">{steps[currentStep - 1]}</div>
      </div>

      {/* RIGHT: Order Summary */}
      <div className="w-64 bg-white border-l border-slate-300 p-4 overflow-y-auto sticky top-0 h-screen">
        <OrderSummary
          pos={{ ...pos, step: currentStep }}
          keypadFocus={keypadFocus}
          setKeypadFocus={setKeypadFocus}
        />
      </div>
    </div>
  );
}
