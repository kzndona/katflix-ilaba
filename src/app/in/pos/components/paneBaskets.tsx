"use client";

import React from "react";
import { Basket, LaundryService } from "../logic/types";

type Props = {
  baskets: Basket[];
  activeBasketIndex: number;
  updateActiveBasket: (p: Partial<Basket>) => void;
  deleteActiveBasket: (index: number) => void;
  createNewBasket: () => void;
  services: LaundryService[];
  onNext: () => void;
};

export default function PaneBaskets({
  baskets,
  activeBasketIndex,
  updateActiveBasket,
  deleteActiveBasket,
  createNewBasket,
  services,
  onNext,
}: Props) {
  const b = baskets[activeBasketIndex];

  // Get service duration from DB by service_type
  const getServiceDuration = (serviceType: string): number => {
    const service = services.find((s) => s.service_type === serviceType);
    return service?.base_duration_minutes || 0;
  };

  // Get service price from DB by service_type
  const getServicePrice = (
    serviceType: string,
    premium: boolean = false
  ): number => {
    const matches = services.filter((s) => s.service_type === serviceType);
    if (matches.length === 0) return 0;

    if (premium) {
      return (
        matches.find((s) => s.name.toLowerCase().includes("premium"))
          ?.rate_per_kg ||
        matches[0]?.rate_per_kg ||
        0
      );
    }

    return (
      matches.find((s) => !s.name.toLowerCase().includes("premium"))
        ?.rate_per_kg ||
      matches[0]?.rate_per_kg ||
      0
    );
  };

  // Simple duration estimation (in minutes, for display purposes)
  const estimateDuration = (serviceType: string, count: number): number => {
    if (count === 0) return 0;
    return getServiceDuration(serviceType) * count;
  };

  // Check if a service is active
  const isServiceActive = (serviceType: string): boolean => {
    const service = services.find(
      (s) =>
        s.service_type === serviceType &&
        !s.name.toLowerCase().includes("premium")
    );
    return service?.is_active ?? false;
  };

  // Check if premium version of a service is active
  const isPremiumServiceActive = (serviceType: string): boolean => {
    const premiumService = services.find(
      (s) =>
        s.service_type === serviceType &&
        s.name.toLowerCase().includes("premium")
    );
    return premiumService?.is_active ?? false;
  };

  const TileWithDuration = ({
    label,
    count,
    serviceType,
    onClick,
    active,
    color,
    title,
    getServicePrice,
    isPremium,
    disabled,
  }: any) => {
    const colorMap: Record<
      string,
      { bg: string; border: string; text: string; accent: string }
    > = {
      blue: {
        bg: "from-blue-50 to-blue-100",
        border: "border-blue-500",
        text: "text-blue-700",
        accent: "text-blue-600",
      },
      green: {
        bg: "from-green-50 to-green-100",
        border: "border-green-500",
        text: "text-green-700",
        accent: "text-green-600",
      },
      red: {
        bg: "from-red-50 to-red-100",
        border: "border-red-500",
        text: "text-red-700",
        accent: "text-red-600",
      },
      orange: {
        bg: "from-orange-50 to-orange-100",
        border: "border-orange-500",
        text: "text-orange-700",
        accent: "text-orange-600",
      },
      teal: {
        bg: "from-teal-50 to-teal-100",
        border: "border-teal-500",
        text: "text-teal-700",
        accent: "text-teal-600",
      },
      purple: {
        bg: "from-purple-50 to-purple-100",
        border: "border-purple-500",
        text: "text-purple-700",
        accent: "text-purple-600",
      },
    };

    const colors = colorMap[color] || colorMap.blue;

    return (
      <div
        className={`rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 shadow-md border-l-4 ${
          disabled
            ? "bg-gray-100 border-gray-400 cursor-not-allowed opacity-40"
            : `bg-linear-to-br ${colors.bg} ${colors.border} hover:shadow-lg hover:to-${color}-150`
        }`}
        onClick={disabled ? undefined : onClick}
      >
        <div className={`text-2xl font-bold mb-2 ${colors.accent}`}>
          {label}
        </div>
        <div className="text-sm font-bold text-center mb-2 text-gray-900">
          {title} {isPremium && "(Prem)"}
        </div>
        <div className={`text-xs ${colors.text}`}>
          {count}x • {estimateDuration(serviceType, count)}m
        </div>
        <div className={`text-xs ${colors.text}`}>
          ₱{getServicePrice(serviceType, isPremium)}/kg
        </div>
      </div>
    );
  };

  const TileButton = ({ label, subLabel, onClick, active, color }: any) => {
    const colorMap: Record<
      string,
      { bg: string; border: string; accent: string }
    > = {
      blue: {
        bg: "from-blue-50 to-blue-100",
        border: "border-blue-500",
        accent: "text-blue-600",
      },
      green: {
        bg: "from-green-50 to-green-100",
        border: "border-green-500",
        accent: "text-green-600",
      },
    };

    const colors = colorMap[color] || colorMap.blue;

    return (
      <div
        className={`rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 shadow-md border-l-4 bg-linear-to-br ${colors.bg} ${colors.border} hover:shadow-lg hover:to-${color}-150`}
        onClick={onClick}
      >
        <div className={`text-3xl font-bold ${colors.accent}`}>{label}</div>
        <div className="text-xs font-semibold mt-2 text-gray-700">
          {subLabel}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {b?.name ?? "Basket"}
      </h2>

      {/* Row 1: Weight, Spin */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <TileButton
          label="−"
          subLabel="Decrease Weight"
          onClick={() =>
            updateActiveBasket({ weightKg: Math.max(0, b.weightKg - 8) })
          }
          color="blue"
          active={true}
        />
        <TileButton
          label="+"
          subLabel="Increase Weight"
          onClick={() =>
            updateActiveBasket({
              weightKg: parseFloat((b.weightKg + 8).toFixed(1)),
            })
          }
          color="green"
          active={true}
        />
        <TileWithDuration
          label="−"
          title="Spin"
          count={b.spinCount}
          serviceType="spin"
          onClick={() =>
            updateActiveBasket({ spinCount: Math.max(0, b.spinCount - 1) })
          }
          active={b.spinCount > 0}
          color="blue"
          getServicePrice={getServicePrice}
          isPremium={false}
          disabled={b.weightKg === 0 || !isServiceActive("spin")}
        />
        <TileWithDuration
          label="+"
          title="Spin"
          count={b.spinCount}
          serviceType="spin"
          onClick={() => updateActiveBasket({ spinCount: b.spinCount + 1 })}
          active={b.spinCount > 0}
          color="green"
          getServicePrice={getServicePrice}
          isPremium={false}
          disabled={b.weightKg === 0 || !isServiceActive("spin")}
        />
      </div>

      {/* Row 2: Wash, Dry */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <TileWithDuration
          label="−"
          title="Wash"
          count={b.washCount}
          serviceType="wash"
          onClick={() =>
            updateActiveBasket({ washCount: Math.max(0, b.washCount - 1) })
          }
          active={b.washCount > 0}
          color="blue"
          getServicePrice={getServicePrice}
          isPremium={b.washPremium}
          disabled={
            b.weightKg === 0 ||
            (!b.washPremium && !isServiceActive("wash")) ||
            (b.washPremium && !isPremiumServiceActive("wash"))
          }
        />
        <TileWithDuration
          label="+"
          title="Wash"
          count={b.washCount}
          serviceType="wash"
          onClick={() => updateActiveBasket({ washCount: b.washCount + 1 })}
          active={b.washCount > 0}
          color="green"
          getServicePrice={getServicePrice}
          isPremium={b.washPremium}
          disabled={
            b.weightKg === 0 ||
            (!b.washPremium && !isServiceActive("wash")) ||
            (b.washPremium && !isPremiumServiceActive("wash"))
          }
        />
        <TileWithDuration
          label="−"
          title="Dry"
          count={b.dryCount}
          serviceType="dry"
          onClick={() =>
            updateActiveBasket({ dryCount: Math.max(0, b.dryCount - 1) })
          }
          active={b.dryCount > 0}
          color="blue"
          getServicePrice={getServicePrice}
          isPremium={b.dryPremium}
          disabled={
            b.weightKg === 0 ||
            (!b.dryPremium && !isServiceActive("dry")) ||
            (b.dryPremium && !isPremiumServiceActive("dry"))
          }
        />
        <TileWithDuration
          label="+"
          title="Dry"
          count={b.dryCount}
          serviceType="dry"
          onClick={() => updateActiveBasket({ dryCount: b.dryCount + 1 })}
          active={b.dryCount > 0}
          color="green"
          getServicePrice={getServicePrice}
          isPremium={b.dryPremium}
          disabled={
            b.weightKg === 0 ||
            (!b.dryPremium && !isServiceActive("dry")) ||
            (b.dryPremium && !isPremiumServiceActive("dry"))
          }
        />
      </div>

      {/* Row 3: Premium options */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div
          className={`col-span-2 rounded-lg flex flex-col items-center justify-center select-none transition h-40 p-3 cursor-pointer shadow-md border-l-4 ${
            b.weightKg === 0 || !isPremiumServiceActive("wash")
              ? "bg-gray-100 border-gray-400 cursor-not-allowed opacity-40"
              : b.washPremium
                ? "bg-linear-to-br from-purple-100 to-purple-150 border-purple-600 hover:shadow-lg"
                : "bg-linear-to-br from-purple-50 to-purple-100 border-purple-500 hover:shadow-lg"
          }`}
          onClick={() => {
            if (b.weightKg !== 0 && isPremiumServiceActive("wash")) {
              updateActiveBasket({ washPremium: !b.washPremium });
            }
          }}
        >
          <div className="text-xl font-bold mb-2 text-purple-600">
            Premium Wash
          </div>
          <div className="text-xs font-semibold text-center text-purple-700">
            {b.weightKg === 0
              ? "Add weight first"
              : !isPremiumServiceActive("wash")
                ? "Premium unavailable"
                : b.washPremium
                  ? "✓ Selected"
                  : "Click to add"}
          </div>
        </div>

        <div
          className={`col-span-2 rounded-lg flex flex-col items-center justify-center select-none transition h-40 p-3 cursor-pointer shadow-md border-l-4 ${
            b.weightKg === 0 || !isPremiumServiceActive("dry")
              ? "bg-gray-100 border-gray-400 cursor-not-allowed opacity-40"
              : b.dryPremium
                ? "bg-linear-to-br from-purple-100 to-purple-150 border-purple-600 hover:shadow-lg"
                : "bg-linear-to-br from-purple-50 to-purple-100 border-purple-500 hover:shadow-lg"
          }`}
          onClick={() => {
            if (b.weightKg !== 0 && isPremiumServiceActive("dry")) {
              updateActiveBasket({ dryPremium: !b.dryPremium });
            }
          }}
        >
          <div className="text-xl font-bold mb-2 text-purple-600">
            Premium Dry
          </div>
          <div className="text-xs font-semibold text-center text-purple-700">
            {b.weightKg === 0
              ? "Add weight first"
              : !isPremiumServiceActive("dry")
                ? "Premium unavailable"
                : b.dryPremium
                  ? "✓ Selected"
                  : "Click to add"}
          </div>
        </div>
      </div>

      {/* Row 4: Iron, Fold */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div
          className={`col-span-2 rounded-lg flex flex-col items-center justify-center select-none transition h-40 p-3 cursor-pointer shadow-md border-l-4 ${
            b.weightKg === 0 || !isServiceActive("iron")
              ? "bg-gray-100 border-gray-400 cursor-not-allowed opacity-40"
              : b.iron
                ? "bg-linear-to-br from-orange-100 to-orange-150 border-orange-600 hover:shadow-lg"
                : "bg-linear-to-br from-orange-50 to-orange-100 border-orange-500 hover:shadow-lg"
          }`}
          onClick={() => {
            if (b.weightKg !== 0 && isServiceActive("iron")) {
              updateActiveBasket({ iron: !b.iron });
            }
          }}
        >
          <div className="text-xl font-bold mb-2 text-orange-600">Iron</div>
          <div className="text-xs font-semibold text-center text-orange-700">
            {b.weightKg === 0
              ? "Add weight first"
              : !isServiceActive("iron")
                ? "Service unavailable"
                : b.iron
                  ? `${estimateDuration("iron", 1)}m✓`
                  : "Click to add"}
          </div>
        </div>

        <div
          className={`col-span-2 rounded-lg flex flex-col items-center justify-center select-none transition h-40 p-3 cursor-pointer shadow-md border-l-4 ${
            b.weightKg === 0 || !isServiceActive("fold")
              ? "bg-gray-100 border-gray-400 cursor-not-allowed opacity-40"
              : b.fold
                ? "bg-linear-to-br from-teal-100 to-teal-150 border-teal-600 hover:shadow-lg"
                : "bg-linear-to-br from-teal-50 to-teal-100 border-teal-500 hover:shadow-lg"
          }`}
          onClick={() => {
            if (b.weightKg !== 0 && isServiceActive("fold")) {
              updateActiveBasket({ fold: !b.fold });
            }
          }}
        >
          <div className="text-xl font-bold mb-2 text-teal-600">Fold</div>
          <div className="text-xs font-semibold text-center text-teal-700">
            {b.weightKg === 0
              ? "Add weight first"
              : !isServiceActive("fold")
                ? "Service unavailable"
                : b.fold
                  ? `${estimateDuration("fold", 1)}m✓`
                  : "Click to add"}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Notes
        </label>
        <textarea
          value={b.notes}
          onChange={(e) => updateActiveBasket({ notes: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Add any special instructions for this basket..."
        />
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-base"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
