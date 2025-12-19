"use client";

import React from "react";
import { HandlingState } from "../logic/orderTypes";

type Props = {
  handling: HandlingState;
  setHandling: (h: HandlingState) => void;
};

export default function PaneHandling({ handling, setHandling }: Props) {
  const deliveryAddressError =
    handling.deliver && !handling.deliveryAddress
      ? "Delivery address is required"
      : null;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Pickup & Delivery
      </h2>

      <div className="space-y-6">
        {/* Delivery Options - Radio Buttons */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="delivery-method"
              checked={handling.pickup && !handling.deliver}
              onChange={() =>
                setHandling({ ...handling, pickup: true, deliver: false })
              }
              className="w-6 h-6 rounded"
            />
            <span className="font-semibold text-gray-900 text-base">
              Pickup at Store
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="delivery-method"
              checked={!handling.pickup && handling.deliver}
              onChange={() =>
                setHandling({ ...handling, pickup: false, deliver: true })
              }
              className="w-6 h-6 rounded"
            />
            <span className="font-semibold text-gray-900 text-base">
              Deliver to Customer
            </span>
          </label>
        </div>

        {/* Delivery Details - Only show if delivery selected */}
        {handling.deliver && (
          <div
            className={`border-2 rounded-lg p-4 transition ${
              deliveryAddressError
                ? "border-red-300 bg-red-50"
                : "border-gray-200"
            }`}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Delivery Address *
                </label>
                <input
                  type="text"
                  placeholder="Customer delivery address"
                  value={handling.deliveryAddress}
                  onChange={(e) =>
                    setHandling({
                      ...handling,
                      deliveryAddress: e.target.value,
                    })
                  }
                  className={`w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    deliveryAddressError ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {deliveryAddressError && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {deliveryAddressError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Delivery Fee (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={handling.deliveryFee || 50}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHandling({
                      ...handling,
                      deliveryFee: val === "" ? 0 : Number(val),
                    });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Special Instructions (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Any special delivery or handling instructions..."
            value={handling.instructions}
            onChange={(e) =>
              setHandling({ ...handling, instructions: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
