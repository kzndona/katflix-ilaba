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
};

export default function PaneBaskets({
  baskets,
  activeBasketIndex,
  updateActiveBasket,
  deleteActiveBasket,
  createNewBasket,
  services,
}: Props) {
  const b = baskets[activeBasketIndex];

  // Get service duration from DB by service_type
  const getServiceDuration = (serviceType: string): number => {
    const service = services.find((s) => s.service_type === serviceType);
    return service?.base_duration_minutes || 0;
  };

  // Get service price from DB by service_type
  const getServicePrice = (serviceType: string): number => {
    const service = services.find((s) => s.service_type === serviceType);
    return service?.rate_per_kg || 0;
  };

  // Simple duration estimation (in minutes, for display purposes)
  const estimateDuration = (serviceType: string, count: number): number => {
    if (count === 0) return 0;
    return getServiceDuration(serviceType) * count;
  };

  const TileButton = ({ label, subLabel, onClick, active, color }: any) => (
    <div
      className={`border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
        active
          ? `border-${color}-500 bg-${color}-50`
          : `border-gray-300 hover:border-${color}-500 hover:bg-${color}-50`
      }`}
      onClick={onClick}
    >
      <div className={`text-5xl text-${color}-600 font-bold`}>{label}</div>
      <div className="text-xs font-semibold text-gray-600 mt-2">{subLabel}</div>
    </div>
  );

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
  }: any) => (
    <div
      className={`border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
        disabled
          ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
          : active
          ? `border-${color}-500 bg-${color}-50`
          : `border-gray-300 hover:border-${color}-500 hover:bg-${color}-50`
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className={`text-5xl text-${color}-600 font-bold`}>{label}</div>
      <div className="text-xs font-semibold text-gray-600 mt-1">
        {title} {isPremium && "(Premium)"}
      </div>
      <div className="text-xs text-gray-700 font-semibold mt-1">
        {count}x ({estimateDuration(serviceType, count)}m)
      </div>
      <div className="text-xs text-gray-600 mt-1">
        ₱{getServicePrice(serviceType)}/kg
      </div>
    </div>
  );

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
            updateActiveBasket({ weightKg: Math.max(0, b.weightKg - 0.5) })
          }
          color="blue"
          active={true}
        />
        <TileButton
          label="+"
          subLabel="Increase Weight"
          onClick={() =>
            updateActiveBasket({
              weightKg: parseFloat((b.weightKg + 0.5).toFixed(1)),
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
          disabled={b.weightKg === 0}
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
          disabled={b.weightKg === 0}
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
          disabled={b.weightKg === 0}
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
          disabled={b.weightKg === 0}
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
          disabled={b.weightKg === 0}
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
          disabled={b.weightKg === 0}
        />
      </div>

      {/* Row 3: Premium options */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div
          className={`col-span-2 border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
            b.washPremium
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 hover:border-purple-500 hover:bg-purple-50"
          }`}
          onClick={() => updateActiveBasket({ washPremium: !b.washPremium })}
        >
          <div className="text-sm font-semibold text-gray-900">
            Premium Wash
          </div>
          <div className="text-xs text-gray-600 font-semibold mt-1">
            {b.washPremium ? "✓ Selected" : "Add Premium"}
          </div>
        </div>

        <div
          className={`col-span-2 border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
            b.dryPremium
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 hover:border-purple-500 hover:bg-purple-50"
          }`}
          onClick={() => updateActiveBasket({ dryPremium: !b.dryPremium })}
        >
          <div className="text-sm font-semibold text-gray-900">Premium Dry</div>
          <div className="text-xs text-gray-600 font-semibold mt-1">
            {b.dryPremium ? "✓ Selected" : "Add Premium"}
          </div>
        </div>
      </div>

      {/* Row 4: Iron, Fold */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div
          className={`col-span-2 border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
            b.weightKg === 0
              ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
              : b.iron
              ? "border-orange-500 bg-orange-50"
              : "border-gray-300 hover:border-orange-500 hover:bg-orange-50"
          }`}
          onClick={() => {
            if (b.weightKg !== 0) {
              updateActiveBasket({ iron: !b.iron });
            }
          }}
        >
          <div className="text-sm font-semibold text-gray-900">Iron</div>
          <div className="text-xs text-gray-600 font-semibold mt-1">
            {b.weightKg === 0
              ? "Add weight first"
              : b.iron
              ? `${estimateDuration("iron", 1)}m`
              : "Click to add"}
          </div>
        </div>

        <div
          className={`col-span-2 border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition h-40 p-3 ${
            b.weightKg === 0
              ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
              : b.fold
              ? "border-teal-500 bg-teal-50"
              : "border-gray-300 hover:border-teal-500 hover:bg-teal-50"
          }`}
          onClick={() => {
            if (b.weightKg !== 0) {
              updateActiveBasket({ fold: !b.fold });
            }
          }}
        >
          <div className="text-sm font-semibold text-gray-900">Fold</div>
          <div className="text-xs text-gray-600 font-semibold mt-1">
            {b.weightKg === 0
              ? "Add weight first"
              : b.fold
              ? `${estimateDuration("fold", 1)}m`
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
    </div>
  );
}
