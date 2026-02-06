"use client";

import React, { useEffect, useState } from "react";
import { usePOSState } from "./logic/usePOSState";
import {
  LocationPicker,
  LocationCoords,
} from "../../components/LocationPicker";
import ReceiptModal from "./components/receiptModal";

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

        {/* RIGHT COLUMN: Additional Dry Time, Iron */}
        <div className="space-y-3 flex flex-col">
          {/* Additional Dry Time */}
          <div className="h-32 flex flex-col">
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
                        {activeBasket.services?.additional_dry_time_minutes ||
                          0}
                      </div>
                      <div className="text-xs text-slate-600">min</div>
                    </div>
                    <div className="text-center min-w-20 border-l border-slate-300 pl-4">
                      <div className="text-sm font-semibold text-slate-700">
                        ₱
                        {(
                          ((activeBasket.services
                            ?.additional_dry_time_minutes || 0) /
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
                              activeBasket.services
                                ?.additional_dry_time_minutes || 0;
                            if (curr > 0)
                              pos.updateActiveBasketService?.(
                                "additional_dry_time_minutes",
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
                              activeBasket.services
                                ?.additional_dry_time_minutes || 0;
                            const maxMinutes =
                              minutes * dryTimeInfo.max_increments;
                            if (curr < maxMinutes)
                              pos.updateActiveBasketService?.(
                                "additional_dry_time_minutes",
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
          <div className="h-32 flex flex-col">
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

          {/* Heavy Fabrics */}
          <div>
            {(() => {
              return (
                <label className="flex items-center gap-2 p-3 border border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 rounded-lg h-20">
                  <input
                    type="checkbox"
                    checked={activeBasket.services?.heavy_fabrics || false}
                    onChange={(e) =>
                      pos.updateActiveBasketService?.("heavy_fabrics", e.target.checked)
                    }
                    className="w-4 h-4 accent-[#c41d7f]"
                  />
                  <div className="text-sm font-semibold text-slate-700">
                    👖 Heavy fabrics (jeans, comforter, etc.)
                  </div>
                </label>
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
              {/* Product Image */}
              <div
                className={`w-full flex-1 rounded mb-2 flex items-center justify-center text-3xl font-semibold overflow-hidden ${
                  pos.selectedProducts[p.id]
                    ? "bg-white bg-opacity-20 text-white"
                    : "bg-slate-300 text-slate-600"
                }`}
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.item_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "📦"
                )}
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
  const [success, setSuccess] = React.useState("");
  const [editedPhone, setEditedPhone] = React.useState("");
  const [editedEmail, setEditedEmail] = React.useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);
  const [isSavingChanges, setIsSavingChanges] = React.useState(false);

  // Validate new customer form
  const validateNewCustomerForm = () => {
    const firstName = pos.newCustomerForm.first_name?.trim();
    const lastName = pos.newCustomerForm.last_name?.trim();
    const phone = pos.newCustomerForm.phone_number?.trim();

    if (!firstName) return "First name is required";
    if (!lastName) return "Last name is required";
    if (!phone) return "Phone number is required";
    if (phone.length < 11) return "Phone number must be at least 11 digits";
    if (phone.length > 13) return "Phone number cannot exceed 13 characters";

    // PH phone format: starts with +63 or 09
    const isValidPhFormat = /^(\+63|09)\d{9,11}$/.test(phone);
    if (!isValidPhFormat) {
      return "Phone must be in PH format: +63XXXXXXXXXX or 09XXXXXXXXXX";
    }

    if (
      pos.newCustomerForm.email_address &&
      !pos.newCustomerForm.email_address.includes("@")
    ) {
      return "Invalid email address";
    }
    return null;
  };

  const validateAndCreate = async () => {
    setError("");
    setSuccess("");

    const validationError = validateNewCustomerForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const firstName = pos.newCustomerForm.first_name?.trim();
    const lastName = pos.newCustomerForm.last_name?.trim();
    const phone = pos.newCustomerForm.phone_number?.trim();

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
        setSuccess(
          `✓ Customer ${data.customer.first_name} created successfully!`,
        );
        setEditedPhone("");
        setEditedEmail("");

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Customer creation error:", err);
      setError("Failed to create customer");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Save phone/email changes for existing customer
  const saveCustomerChanges = async () => {
    if (!pos.customer || (!editedPhone && !editedEmail)) return;

    setError("");
    setSuccess("");
    setIsSavingChanges(true);

    try {
      const response = await fetch("/api/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pos.customer.id,
          first_name: pos.customer.first_name,
          last_name: pos.customer.last_name,
          phone_number: editedPhone || pos.customer.phone_number,
          email_address: editedEmail || pos.customer.email_address,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to save changes");
        return;
      }

      const data = await response.json();
      if (data.success && data.customer) {
        // Update the selected customer
        pos.selectCustomer({
          id: data.customer.id,
          first_name: data.customer.first_name,
          last_name: data.customer.last_name,
          phone_number: data.customer.phone_number,
          email_address: data.customer.email_address,
          loyalty_points: pos.customer.loyalty_points,
        });

        setSuccess("✓ Changes saved successfully!");
        setEditedPhone("");
        setEditedEmail("");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Save changes error:", err);
      setError("Failed to save changes");
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleChangeCustomer = () => {
    setEditedPhone("");
    setEditedEmail("");
    setError("");
    setSuccess("");
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
      <div
        className={`space-y-3 rounded-lg p-4 border-2 transition ${
          pos.customer
            ? "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-green-500 shadow-sm"
            : "bg-slate-50 border-slate-300"
        }`}
      >
        {pos.customer && (
          <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 border-l-4 border-green-700 rounded text-sm text-green-900 font-semibold">
            ✓ {pos.customer.first_name} {pos.customer.last_name} selected
          </div>
        )}

        {/* First Name | Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              First Name
            </label>
            <input
              type="text"
              placeholder="First Name"
              maxLength={50}
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
                  setSuccess("");
                }
              }}
              disabled={!!pos.customer}
              className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm w-full disabled:bg-slate-200 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Last Name
            </label>
            <input
              type="text"
              placeholder="Last Name"
              maxLength={50}
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
                  setSuccess("");
                }
              }}
              disabled={!!pos.customer}
              className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm w-full disabled:bg-slate-200 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Phone | Email */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Phone (PH Format)
            </label>
            <input
              type="tel"
              placeholder="+63 or 09"
              maxLength={13}
              value={
                editedPhone ||
                (pos.customer
                  ? pos.customer.phone_number
                  : pos.newCustomerForm.phone_number)
              }
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9+]/g, "");
                if (pos.customer) {
                  setEditedPhone(val);
                } else {
                  pos.setNewCustomerForm({
                    ...pos.newCustomerForm,
                    phone_number: val,
                  });
                }
                setError("");
                setSuccess("");
              }}
              className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              maxLength={100}
              value={
                editedEmail ||
                (pos.customer
                  ? pos.customer.email_address || ""
                  : pos.newCustomerForm.email_address)
              }
              onChange={(e) => {
                const val = e.target.value;
                if (pos.customer) {
                  setEditedEmail(val);
                } else {
                  pos.setNewCustomerForm({
                    ...pos.newCustomerForm,
                    email_address: val,
                  });
                }
                setError("");
                setSuccess("");
              }}
              className="border-2 border-slate-300 rounded-lg px-4 py-3 text-sm w-full"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded text-xs text-red-700 font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 border border-green-300 rounded text-xs text-green-700 font-semibold">
            {success}
          </div>
        )}

        {pos.customer ? (
          <div className="space-y-2">
            {(editedPhone || editedEmail) && (
              <button
                onClick={saveCustomerChanges}
                disabled={isSavingChanges}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isSavingChanges ? "Saving..." : "Save Changes"}
              </button>
            )}
            <button
              onClick={handleChangeCustomer}
              className="w-full bg-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
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

function Step5Handling({
  pos,
  showLocationPicker,
  setShowLocationPicker,
}: {
  pos: any;
  showLocationPicker: boolean;
  setShowLocationPicker: (show: boolean) => void;
}) {
  const addressInputRef = React.useRef<HTMLInputElement>(null);

  // Setup Places Autocomplete on address field
  React.useEffect(() => {
    if (!addressInputRef.current || !window.google?.maps?.places) return;

    // Skip autocomplete if location is already pinned
    if (pos.deliveryLng && pos.deliveryLat) return;

    const caloocanBounds = new window.google.maps.LatLngBounds(
      new window.google.maps.LatLng(14.58, 120.89),
      new window.google.maps.LatLng(14.76, 121.08),
    );

    const autocomplete = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        fields: ["geometry", "formatted_address", "name"],
        bounds: caloocanBounds,
        strictBounds: false,
        componentRestrictions: { country: "ph" },
      },
    );

    autocomplete.setBounds(caloocanBounds);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const coords = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: place.formatted_address,
      };

      pos.setDeliveryAddress(place.formatted_address);
      pos.setDeliveryLat(coords.lat);
      pos.setDeliveryLng(coords.lng);
      console.log("Address field updated location:", coords);
    });
  }, [pos, pos.deliveryLng, pos.deliveryLat]);

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
          <div className="flex gap-2">
            <input
              ref={addressInputRef}
              type="text"
              placeholder="Address"
              value={pos.deliveryAddress}
              onChange={(e) => pos.setDeliveryAddress(e.target.value)}
              disabled={!!(pos.deliveryLng && pos.deliveryLat)}
              className="flex-1 border-2 border-slate-300 rounded-lg px-4 py-3 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => setShowLocationPicker(true)}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition whitespace-nowrap"
            >
              📍 Pin Location
            </button>
          </div>
          {pos.deliveryLng && pos.deliveryLat && (
            <div className="text-xs text-green-700 font-medium">
              ✓ Location pinned: {pos.deliveryLat.toFixed(6)},{" "}
              {pos.deliveryLng.toFixed(6)}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Delivery Fee (minimum ₱{deliveryFeeDefault.toFixed(2)})
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Fee"
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

      {/* Scheduling */}
      <div className="space-y-3 bg-blue-50 border-2 border-blue-300 rounded-lg p-4 w-full">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pos.scheduled}
            onChange={(e) => pos.setScheduled(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <div className="text-sm font-semibold text-slate-700">
            📅 Schedule for later?
          </div>
        </label>

        {pos.scheduled && (
          <div className="space-y-3 ml-6 pt-2 border-t border-blue-200">
            {/* Date Picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={pos.scheduledDate}
                onChange={(e) => pos.setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0]}
                className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-sm"
              />
            </div>

            {/* Time Picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Time (1:00 PM - 5:00 PM)
              </label>
              <select
                value={pos.scheduledTime}
                onChange={(e) => pos.setScheduledTime(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-sm"
              >
                <option value="13:00">1:00 PM</option>
                <option value="13:30">1:30 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="14:30">2:30 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="15:30">3:30 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="16:30">4:30 PM</option>
                <option value="17:00">5:00 PM</option>
              </select>
            </div>
          </div>
        )}
      </div>
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

  // Helper to get plastic bags product price from products table
  const getPlasticBagsPrice = () => {
    const plasticBagProduct = pos.products.find(
      (p: any) =>
        p.item_name?.toLowerCase().includes("plastic") ||
        p.item_name?.toLowerCase().includes("bag"),
    );
    return plasticBagProduct?.unit_price || 0.5; // Default to 0.50 if not found
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
              // Helper to get service price from services or database
              const getServicePrice = (serviceType: string, tier?: string) => {
                const matching = pos.services.filter(
                  (s: any) => s.service_type === serviceType,
                );
                if (!matching.length) return 0;
                const service =
                  matching.find((s: any) => !tier || s.tier === tier) ||
                  matching[0];
                return service.base_price || 0;
              };

              const basket = pos.baskets[i];
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Basket {i + 1}</span>
                    <span>₱{b.subtotal.toFixed(2)}</span>
                  </div>
                  {b.services && (
                    <>
                      {b.services.wash && b.services.wash !== "off" && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>🧺 Wash ({b.services.wash})</span>
                          <span className="font-semibold">
                            ₱
                            {getServicePrice("wash", b.services.wash).toFixed(
                              2,
                            )}
                          </span>
                        </div>
                      )}
                      {b.services.spin && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>🌀 Spin</span>
                          <span className="font-semibold">
                            ₱{getServicePrice("spin").toFixed(2)}
                          </span>
                        </div>
                      )}
                      {b.services.dry && b.services.dry !== "off" && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>💨 Dry ({b.services.dry})</span>
                          <span className="font-semibold">
                            ₱{getServicePrice("dry", b.services.dry).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(b.services.additional_dry_time_minutes || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>
                            ⏱️ Extra Dry (
                            {b.services.additional_dry_time_minutes}
                            m)
                          </span>
                          <span className="font-semibold">
                            ₱
                            {(
                              ((b.services.additional_dry_time_minutes || 0) /
                                getAdditionalDryTimeInfo()
                                  .minutes_per_increment) *
                              getAdditionalDryTimeInfo().price_per_increment
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(b.services.iron_weight_kg || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>👔 Iron ({b.services.iron_weight_kg}kg)</span>
                          <span className="font-semibold">
                            ₱
                            {(
                              (b.services.iron_weight_kg || 0) *
                              getServicePrice("iron")
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(b.services.plastic_bags || 0) > 0 && (
                        <div className="flex justify-between text-xs ml-3 text-slate-600">
                          <span>🛍️ Bags ({b.services.plastic_bags}pc)</span>
                          <span className="font-semibold">
                            ₱
                            {(
                              (b.services.plastic_bags || 0) *
                              getPlasticBagsPrice()
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

        {pos.scheduled && pos.scheduledDate && (
          <div className="bg-blue-50 border border-blue-300 rounded p-2 space-y-1">
            <div className="text-xs text-slate-600 font-semibold uppercase">
              📅 Scheduled Order
            </div>
            <div className="text-xs text-slate-900">
              {new Date(pos.scheduledDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              at {pos.scheduledTime}
            </div>
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
                  checked={pos.loyaltyDiscountTier === "tier1"}
                  onChange={() => pos.setLoyaltyDiscountTier("tier1")}
                  className="w-4 h-4 accent-[#c41d7f] rounded mt-0.5 shrink-0"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-900">
                    10 pts → 5% OFF
                  </div>
                  <div className="text-slate-600">
                    Save ₱{(breakdown.summary.total * 0.05).toFixed(2)}
                  </div>
                </div>
              </label>
            )}

            {/* Tier 2: 20 points for 15% discount */}
            {(pos.customer.loyalty_points || 0) >= 20 && (
              <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-pink-100 border border-pink-200">
                <input
                  type="radio"
                  name="loyaltyTier"
                  checked={pos.loyaltyDiscountTier === "tier2"}
                  onChange={() => pos.setLoyaltyDiscountTier("tier2")}
                  className="w-4 h-4 accent-[#c41d7f] rounded mt-0.5 shrink-0"
                />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-900">
                    20 pts → 15% OFF
                  </div>
                  <div className="text-slate-600">
                    Save ₱{(breakdown.summary.total * 0.15).toFixed(2)}
                  </div>
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
            <span>
              -₱
              {(pos.loyaltyDiscountTier === "tier1"
                ? breakdown.summary.total * 0.05
                : breakdown.summary.total * 0.15
              ).toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-between font-bold text-base text-amber-700 bg-slate-100 rounded px-2 py-1">
          <span>TOTAL</span>
          <span>
            ₱
            {(() => {
              let discountPercent = 0;
              if (pos.loyaltyDiscountTier === "tier1") discountPercent = 0.05;
              if (pos.loyaltyDiscountTier === "tier2") discountPercent = 0.15;
              const totalAmount =
                pos.customer && pos.loyaltyDiscountTier
                  ? breakdown.summary.total * (1 - discountPercent)
                  : breakdown.summary.total;
              return totalAmount.toFixed(2);
            })()}
          </span>
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
            {pos.amountPaid > 0 &&
              (() => {
                let discountPercent = 0;
                if (pos.loyaltyDiscountTier === "tier1") discountPercent = 0.05;
                if (pos.loyaltyDiscountTier === "tier2") discountPercent = 0.15;
                const totalAmount =
                  pos.customer && pos.loyaltyDiscountTier
                    ? breakdown.summary.total * (1 - discountPercent)
                    : breakdown.summary.total;
                return pos.amountPaid >= totalAmount ? (
                  <div className="p-2 bg-slate-100 rounded text-xs font-semibold text-slate-900">
                    Change: ₱
                    {Math.max(0, pos.amountPaid - totalAmount).toFixed(2)}
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
  const [mounted, setMounted] = useState(false);
  const [keypadFocus, setKeypadFocus] = useState<"amount" | "gcash" | null>(
    null,
  );
  const [staffName, setStaffName] = useState<string>("");
  const [staffId, setStaffId] = useState<string>("");
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [reportOrders, setReportOrders] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (pos.step === 0) pos.setStep(1);

    // Fetch staff info from session
    const fetchStaffInfo = async () => {
      try {
        const res = await fetch("/api/auth/user");
        if (res.ok) {
          const data = await res.json();
          console.log("[POS] Auth user data:", data);
          const name =
            data.staff_name ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Staff";
          setStaffName(name);
          setStaffId(data.staff_id || "");
          console.log("[POS] Set staffId:", data.staff_id);
          console.log("[POS] Set staffName:", name);
        } else {
          console.error("[POS] Failed to fetch auth user, status:", res.status);
        }
      } catch (err) {
        console.error("[POS] Failed to fetch staff info:", err);
      }
    };

    fetchStaffInfo();
  }, []);

  if (!mounted) return null;

  const currentStep = Math.max(1, Math.min(5, pos.step || 1));
  const steps = [
    <Step4Customer pos={pos} />,
    <Step1ServiceType pos={pos} />,
    <Step2Baskets pos={pos} />,
    <Step3Products pos={pos} />,
    <Step5Handling
      pos={pos}
      showLocationPicker={showLocationPicker}
      setShowLocationPicker={setShowLocationPicker}
    />,
  ];

  const handleDailySalesReport = async () => {
    setShowSalesReport(true);
    setReportLoading(true);

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch all orders and filter by cashier
      const res = await fetch("/api/orders", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        console.log("[Sales Report] Total orders fetched:", data.length);
        console.log("[Sales Report] Current staffId:", staffId);

        // Filter by cashier and today's date
        const filteredOrders = (data || []).filter((order: any) => {
          const orderDate = order.created_at
            ? new Date(order.created_at)
            : null;
          const matchesCashier = order.cashier_id === staffId;
          const isToday =
            orderDate && orderDate >= today && orderDate < tomorrow;

          if (!matchesCashier && order.cashier_id) {
            console.log(
              `[Sales Report] Order ${order.id.slice(0, 8)} cashier_id: ${order.cashier_id}, not matching ${staffId}`,
            );
          }

          return matchesCashier && isToday;
        });

        console.log("[Sales Report] Filtered orders:", filteredOrders.length);

        setReportOrders(
          filteredOrders.sort((a: any, b: any) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            return timeB - timeA; // Most recent first
          }),
        );
      }
    } catch (err) {
      console.error("Failed to fetch sales report:", err);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* LEFT: Sidebar - Steps & Baskets */}
      {true && (
        <div className="w-48 bg-slate-800 text-slate-50 border-r border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Step Navigation Tabs */}
          <div className="space-y-2 pb-4 border-b border-slate-700">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Steps
            </div>
            {[
              { num: 1, label: "Customer" },
              { num: 2, label: "Service" },
              { num: 3, label: "Baskets" },
              { num: 4, label: "Products" },
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

          {/* Daily Sales Report Button */}
          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={handleDailySalesReport}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
            >
              📊 Daily Sales Report
            </button>
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

      {/* Daily Sales Report Modal */}
      {showSalesReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-50 to-blue-100 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Daily Sales Report
                </h2>
                <p className="text-xs text-gray-600">Cashier: {staffName}</p>
              </div>
              <button
                onClick={() => setShowSalesReport(false)}
                className="text-gray-600 hover:text-gray-900 text-xl font-light transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {reportLoading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading transactions...
                </div>
              ) : reportOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No transactions found for today
                </div>
              ) : (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left px-4 py-2 font-semibold text-gray-700">
                            Order ID
                          </th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-700">
                            Customer
                          </th>
                          <th className="text-center px-4 py-2 font-semibold text-gray-700">
                            Time
                          </th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-700">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportOrders.map((order: any, idx: number) => (
                          <tr
                            key={order.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-4 py-2 text-gray-900 font-mono text-xs">
                              {order.id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {order.customers
                                ? `${order.customers.first_name} ${order.customers.last_name}`
                                : "Walk-in"}
                            </td>
                            <td className="px-4 py-2 text-gray-600 text-center">
                              {new Date(order.created_at).toLocaleTimeString(
                                "en-PH",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                              ₱{order.total_amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-blue-50 border-t-2 border-blue-300 font-bold">
                          <td
                            colSpan={3}
                            className="px-4 py-3 text-right text-gray-900"
                          >
                            TOTAL
                          </td>
                          <td className="px-4 py-3 text-right text-blue-700 text-lg">
                            ₱
                            {reportOrders
                              .reduce(
                                (sum: number, order: any) =>
                                  sum + order.total_amount,
                                0,
                              )
                              .toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">
                        Transaction Count
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {reportOrders.length}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-blue-700">
                        ₱
                        {reportOrders
                          .reduce(
                            (sum: number, order: any) =>
                              sum + order.total_amount,
                            0,
                          )
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">
                        Average Transaction
                      </p>
                      <p className="text-2xl font-bold text-green-700">
                        ₱
                        {(
                          reportOrders.reduce(
                            (sum: number, order: any) =>
                              sum + order.total_amount,
                            0,
                          ) / (reportOrders.length || 1)
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => setShowSalesReport(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={pos.showReceiptModal}
        receiptContent={pos.receiptContent}
        orderId={pos.lastOrderId || ""}
        onClose={() => pos.setShowReceiptModal(false)}
      />

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          onSelect={async (coords: LocationCoords) => {
            pos.setDeliveryLng(coords.lng);
            pos.setDeliveryLat(coords.lat);

            // Reverse geocode coordinates to get address
            if (window.google?.maps?.Geocoder) {
              const geocoder = new (window.google.maps.Geocoder as any)();
              geocoder.geocode(
                { location: { lat: coords.lat, lng: coords.lng } },
                (results: any, status: any) => {
                  if (status === "OK" && results?.[0]) {
                    pos.setDeliveryAddress(results[0].formatted_address);
                    console.log(
                      "Address from geocoding:",
                      results[0].formatted_address,
                    );
                  }
                },
              );
            }

            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
          title="Pin Delivery Location"
          defaultLocation={
            pos.deliveryLng && pos.deliveryLat
              ? { lat: pos.deliveryLat, lng: pos.deliveryLng }
              : undefined
          }
          storeLocation={{
            lat: parseFloat(
              process.env.NEXT_PUBLIC_KATFLIX_LATITUDE || "14.5994",
            ),
            lng: parseFloat(
              process.env.NEXT_PUBLIC_KATFLIX_LONGITUDE || "120.9842",
            ),
          }}
        />
      )}
    </div>
  );
}
