"use client";

import React from "react";
import { PRICING } from "../logic/usePOSState";

type HandlingInfo = {
  pickup: boolean;
  deliver: boolean;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryFee: number;
  courierRef: string;
  instructions: string;
};

type Props = {
  customer: any;
  computeReceipt: any;
  handling: HandlingInfo; // <-- update type
  setShowConfirm: (v: boolean) => void;
  setOrderProductCounts: (o: any) => void;
  setBaskets: (b: any) => void;
  setActiveBasketIndex: (i: number) => void;
  saveOrder: () => Promise<void>;
  resetPOS: () => void;
};

export default function PaneReceipt({
  customer,
  computeReceipt,
  handling,
  setShowConfirm,
  setOrderProductCounts,
  setBaskets,
  setActiveBasketIndex,
  saveOrder,
  resetPOS,
}: Props) {
  // Check if order is valid
  const isOrderValid = () => {
    if (!customer?.first_name || !customer?.last_name) return false;
    const hasProducts = computeReceipt.productLines.length > 0;
    const hasServices = computeReceipt.basketLines.length > 0;
    return hasProducts || hasServices;
  };

  return (
    <aside className="bg-white border-l border-gray-200 p-4 flex flex-col h-full overflow-hidden rounded-lg">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Receipt</h3>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {/* Customer Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">Customer</div>
          <div className="text-base font-semibold text-gray-900">
            {customer && (customer.first_name || customer.last_name)
              ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
              : "—"}
          </div>
        </div>

        {/* Products Section */}
        {computeReceipt.productLines.length > 0 && (
          <div>
            <div className="font-semibold text-gray-900 text-sm mb-2">
              Products
            </div>
            <div className="space-y-2">
              {computeReceipt.productLines.map((pl: any) => (
                <div key={pl.id} className="flex justify-between text-sm">
                  <div>
                    <div className="text-gray-900">{pl.name}</div>
                    <div className="text-xs text-gray-500">
                      {pl.qty} × ₱{pl.price}
                    </div>
                  </div>
                  <div className="font-medium">₱{pl.lineTotal.toFixed(2)}</div>
                </div>
              ))}
            </div>
            {computeReceipt.basketLines.length > 0 && (
              <div className="flex justify-between text-gray-700 font-semibold mt-2 pt-1 border-t border-gray-300" />
            )}
          </div>
        )}

        {/* Baskets Section */}
        {computeReceipt.basketLines.length > 0 && (
          <div>
            <div className="font-semibold text-gray-900 text-base mb-2">
              Services
            </div>
            <div className="space-y-2">
              {computeReceipt.basketLines.map((b: any, idx: number) => (
                <div key={b.id}>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <div className="text-gray-900 font-medium">
                        {b.name} • {b.weightKg}kg
                      </div>
                      <div className="font-medium">₱{b.total.toFixed(2)}</div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 mt-1">
                      {Object.entries(b.breakdown)
                        .filter(([_, val]) => (val as number) > 0)
                        .map(([service, val]) => (
                          <div key={service} className="flex justify-between">
                            <span>
                              {service.charAt(0).toUpperCase() +
                                service.slice(1)}{" "}
                              {b[`${service}Premium`] && "(Premium)"}
                            </span>
                            <span>₱{(val as number).toFixed(2)}</span>
                          </div>
                        ))}
                      <div className="border-t border-gray-100 mt-2">
                        <span>Estimated Duration:</span>
                        <span>{b.estimatedDurationMinutes} min</span>
                      </div>
                    </div>
                  </div>
                  {idx < computeReceipt.basketLines.length - 1 && (
                    <div className="border-t border-gray-200 mt-4" />
                  )}
                </div>
              ))}

              {/* Total Estimated Duration across all baskets */}
              {computeReceipt.basketLines.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 mt-3 border border-blue-200">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      Total Estimated Duration
                    </span>
                    <span className="font-bold text-blue-600">
                      {computeReceipt.basketLines.reduce(
                        (sum: number, b: any) =>
                          sum + b.estimatedDurationMinutes,
                        0
                      )}{" "}
                      min
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Totals Section */}
      <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">
            ₱
            {(
              computeReceipt.productSubtotal + computeReceipt.basketSubtotal
            ).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">
            VAT ({(PRICING.taxRate * 100).toFixed(0)}%)
          </span>
          <span className="font-medium">
            ₱{computeReceipt.taxIncluded.toFixed(2)}
          </span>
        </div>
        {handling.deliver && (
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery Fee</span>
            <span className="font-medium">
              ₱{handling.deliveryFee.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold bg-blue-50 p-3 rounded-lg">
          <span>Total</span>
          <span>₱{computeReceipt.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!isOrderValid()}
          className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          Checkout
        </button>
        <button
          onClick={() => resetPOS()}
          className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
