"use client";

import React from "react";
import { PRICING } from "../logic/usePOSState";
import { HandlingState } from "../logic/orderTypes";

type Props = {
  customer: any;
  computeReceipt: any;
  handling: HandlingState;
  setShowConfirm: (v: boolean) => void;
  saveOrder: () => Promise<void>;
  resetPOS: () => void;
  customerLoyaltyPoints?: number;
  useLoyaltyDiscount?: boolean;
  setUseLoyaltyDiscount?: (v: boolean) => void;
};

export default function PaneReceipt({
  customer,
  computeReceipt,
  handling,
  setShowConfirm,
  saveOrder,
  resetPOS,
  customerLoyaltyPoints = 0,
  useLoyaltyDiscount = false,
  setUseLoyaltyDiscount,
}: Props) {
  const isCustomerValid =
    customer?.first_name && customer?.last_name && customer?.phone_number;
  const hasProducts = computeReceipt.productLines.length > 0;
  const hasServices =
    computeReceipt.basketLines.length > 0 &&
    computeReceipt.basketLines.some((b: any) => b.weightKg > 0);

  // Check if trying to deliver products-only order (not allowed)
  const isProductsOnlyOrder = hasProducts && !hasServices;
  const isDeliverySelected = handling.deliver;
  const deliveryWithProductsOnlyError =
    isProductsOnlyOrder && isDeliverySelected
      ? "Cannot deliver product-only orders. Products must be picked up at the store."
      : null;

  const isOrderValid = isCustomerValid && (hasProducts || hasServices) && !deliveryWithProductsOnlyError;

  const basketWarnings = computeReceipt.basketLines
    .filter((b: any) => b.weightKg > 0)
    .filter((b: any) => !Object.values(b.breakdown).some((val: any) => val > 0))
    .map((b: any) => `${b.name} has weight (${b.weightKg}kg) but no services`);

  return (
    <aside className="bg-white border-l border-gray-200 p-6 flex flex-col h-full overflow-hidden rounded-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Receipt</h3>

      <div className="flex-1 overflow-y-auto pr-3 space-y-5">
        {/* Customer Info */}
        <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Customer
          </div>
          <div className="text-lg font-bold text-gray-900 mb-4">
            {customer && (customer.first_name || customer.last_name)
              ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
              : "—"}
          </div>
          <div className="space-y-2">
            {customer?.phone_number && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase mt-0.5">
                  Mobile:
                </span>
                <span className="text-sm text-gray-700">
                  {customer.phone_number}
                </span>
              </div>
            )}
            {customer?.email_address && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase mt-0.5">
                  Email:
                </span>
                <span className="text-sm text-gray-700 break-all">
                  {customer.email_address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Basket Warnings */}
        {basketWarnings.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 shrink-0 text-yellow-600 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-yellow-900 mb-1">
                  ⚠️ Baskets with no services
                </div>
                <div className="text-xs text-yellow-800 space-y-1">
                  {basketWarnings.map((warning: string, idx: number) => (
                    <div key={idx}>• {warning}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery with Products-Only Error */}
        {deliveryWithProductsOnlyError && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 shrink-0 text-red-600 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-red-900 mb-1">
                  ❌ Delivery Not Allowed
                </div>
                <div className="text-xs text-red-800">
                  {deliveryWithProductsOnlyError}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Section */}
        {computeReceipt.productLines.length > 0 && (
          <div className="pt-3">
            <div className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-4">
              Products
            </div>
            <div className="space-y-3">
              {computeReceipt.productLines.map((pl: any) => (
                <div key={pl.id} className="flex justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {pl.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {pl.qty} × ₱{pl.price}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900">
                    ₱{pl.lineTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            {computeReceipt.basketLines.length > 0 && (
              <div className="border-t-2 border-gray-200 mt-5 pt-5" />
            )}
          </div>
        )}

        {/* Baskets Section */}
        {computeReceipt.basketLines.length > 0 && (
          <div className="pt-3">
            <div className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-4">
              Services
            </div>
            <div className="space-y-3">
              {computeReceipt.basketLines.map((b: any, idx: number) => (
                <div
                  key={b.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition"
                >
                  <div className="flex justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="text-gray-900 font-semibold text-base">
                      {b.name} • {b.weightKg}kg
                    </div>
                    <div className="font-bold text-gray-900 text-base">
                      ₱{b.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1.5 ml-1">
                    {Object.entries(b.breakdown)
                      .filter(([_, val]) => (val as number) > 0)
                      .map(([service, val]) => (
                        <div key={service} className="flex justify-between">
                          <span className="text-gray-700 font-medium">
                            {service.charAt(0).toUpperCase() + service.slice(1)}{" "}
                            {(b.premiumFlags as any)[service] && "(Premium)"}
                          </span>
                          <span className="font-semibold text-gray-700">
                            ₱{(val as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    <div className="flex justify-between text-xs pt-2 mt-2 border-t border-gray-300">
                      <span className="text-gray-600 font-medium">
                        Duration:
                      </span>
                      <span className="font-bold text-gray-700">
                        {b.estimatedDurationMinutes} min
                      </span>
                    </div>
                    {b.notes && (
                      <div className="pt-2 mt-2 border-t border-gray-300">
                        <span className="text-gray-600 font-medium text-xs block mb-1">
                          Notes:
                        </span>
                        <p className="text-gray-700 text-xs whitespace-pre-wrap">
                          {b.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Total Estimated Duration across all baskets */}
              {computeReceipt.basketLines.length > 0 && (
                <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-4 mt-2 border border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900 text-sm">
                      Total Estimated Duration
                    </span>
                    <span className="font-bold text-blue-700 text-base">
                      {computeReceipt.basketLines.reduce(
                        (sum: number, b: any) =>
                          sum + b.estimatedDurationMinutes,
                        0,
                      )}{" "}
                      min
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Handling Info */}
        {(handling.deliver || handling.pickup) && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Handling
            </div>
            <div className="space-y-3 text-sm">
              {handling.deliver && (
                <>
                  <div>
                    <div className="text-xs font-bold text-gray-700 uppercase mb-1">
                      Delivery Address
                    </div>
                    <p className="text-gray-900 font-light">
                      {handling.deliveryAddress}
                    </p>
                  </div>
                  {handling.instructions && (
                    <div>
                      <div className="text-xs font-bold text-gray-700 uppercase mb-1">
                        Instructions
                      </div>
                      <p className="text-gray-900 font-light whitespace-pre-wrap">
                        {handling.instructions}
                      </p>
                    </div>
                  )}
                </>
              )}
              {handling.pickup && !handling.deliver && (
                <div className="text-gray-900 font-medium">
                  🏪 Pickup at Store
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loyalty Discount Section */}
      {customerLoyaltyPoints >= 10 && (
        <div className="bg-linear-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200 mt-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-amber-900 mb-1">
                💰 Loyalty Points Available
              </div>
              <div className="text-xs text-amber-800">
                {customerLoyaltyPoints} points
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useLoyaltyDiscount}
                onChange={(e) => setUseLoyaltyDiscount?.(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-xs font-semibold text-amber-900">Use</span>
            </label>
          </div>
          {useLoyaltyDiscount && (
            <div className="bg-white rounded p-3 text-sm">
              {customerLoyaltyPoints >= 20 ? (
                <div className="text-amber-900 font-semibold">
                  🎉 15% discount - ₱
                  {computeReceipt.loyaltyDiscountAmount.toFixed(2)} off
                </div>
              ) : (
                <div className="text-amber-900 font-semibold">
                  10% discount - ₱
                  {computeReceipt.loyaltyDiscountAmount.toFixed(2)} off
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Totals Section */}
      <div className="border-t-2 border-gray-300 pt-5 space-y-4 text-sm mt-5">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-semibold text-gray-900">
            ₱
            {(
              computeReceipt.productSubtotal + computeReceipt.basketSubtotal
            ).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">
            {(PRICING.taxRate * 100).toFixed(0)}% VAT (incl.)
          </span>
          <span className="font-semibold text-gray-900">
            ₱{computeReceipt.taxIncluded.toFixed(2)}
          </span>
        </div>
        {computeReceipt.serviceFee > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Service Fee</span>
            <span className="font-semibold text-gray-900">
              ₱{computeReceipt.serviceFee.toFixed(2)}
            </span>
          </div>
        )}
        {handling.deliver && (
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery Fee</span>
            <span className="font-semibold text-gray-900">
              ₱{handling.deliveryFee.toFixed(2)}
            </span>
          </div>
        )}
        {computeReceipt.loyaltyDiscountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span className="font-semibold">
              Loyalty Discount ({computeReceipt.loyaltyDiscountPercentage}%)
            </span>
            <span className="font-bold">
              -₱{computeReceipt.loyaltyDiscountAmount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-t-2 border-gray-300 pt-4 mt-4" />
        <div className="flex justify-between text-base font-bold bg-linear-to-r from-blue-600 to-blue-700 text-white p-5 rounded-lg">
          <span>Total</span>
          <span>₱{computeReceipt.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!isOrderValid || basketWarnings.length > 0}
          className="flex-1 py-4 rounded-lg bg-linear-to-r from-green-600 to-green-700 text-white font-bold text-base hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg"
        >
          Checkout
        </button>
        <button
          onClick={() => resetPOS()}
          className="flex-1 py-4 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold text-base hover:bg-gray-100 transition"
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
