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
  setShowConfirm,
  setOrderProductCounts,
  setBaskets,
  setActiveBasketIndex,
  saveOrder,
  resetPOS,
}: Props) {
  // Placeholder handling string
  const handling = "Handling info placeholder";

  // inside PaneReceipt
  const vatAmount =
    (computeReceipt.total * PRICING.taxRate) / (1 + PRICING.taxRate);

  return (
    <aside className="bg-white border rounded-xl p-5 overflow-auto min-h-[600px]">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">Receipt</h3>
        <div className="text-xs text-gray-500">Thermal preview</div>
      </div>

      {/* Customer Info */}
      <div className="mt-3 text-sm text-gray-700">
        <div>
          <strong>Customer:</strong>{" "}
          {customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`
            : "Guest"}
        </div>
        <div className="text-xs text-gray-500">{handling}</div>
      </div>

      <hr className="my-3" />

      {/* Products */}
      <div className="text-sm">
        <div className="font-medium mb-2">Products</div>
        <div className="space-y-2">
          {computeReceipt.productLines.length === 0 && (
            <div className="text-xs text-gray-500">No product purchases</div>
          )}
          {computeReceipt.productLines.map((pl: any) => (
            <div key={pl.id} className="flex justify-between">
              <div>
                <div className="font-medium">
                  {pl.name} × {pl.qty}
                </div>
                <div className="text-xs text-gray-500">₱{pl.price} each</div>
              </div>
              <div>₱{pl.lineTotal.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <hr className="my-3" />

        {/* Baskets */}
        <div className="font-medium mb-2">Baskets</div>
        <div className="space-y-2">
          {computeReceipt.basketLines.map((b: any) => (
            <div key={b.id} className="flex justify-between text-sm">
              <div className="flex flex-col">
                <div className="font-medium">
                  {b.name} • {b.weightKg} kg
                </div>
                {/* Services vertically */}
                {Object.entries(b.breakdown)
                  .filter(([_, val]) => (val as number) > 0)
                  .map(([service, val]) => (
                    <div key={service} className="text-xs text-gray-500">
                      {service.charAt(0).toUpperCase() + service.slice(1)}: ₱
                      {(val as number).toFixed(2)}
                    </div>
                  ))}
              </div>
              <div>₱{b.total.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Pickup / Delivery */}
        {(computeReceipt.pickup || computeReceipt.delivery) && (
          <div className="text-sm mb-3">
            {computeReceipt.pickup && (
              <div>
                <strong>Pickup:</strong> {computeReceipt.pickup.location} •{" "}
                {computeReceipt.pickup.trips} trip(s) • ₱50
              </div>
            )}
            {computeReceipt.delivery && (
              <div>
                <strong>Delivery:</strong> {computeReceipt.delivery.location} •{" "}
                {computeReceipt.delivery.trips} trip(s) • ₱50
              </div>
            )}
          </div>
        )}

        {/* Subtotals */}
        <div className="mt-4 border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between">
            <div>Products subtotal</div>
            <div>₱{computeReceipt.productSubtotal.toFixed(2)}</div>
          </div>
          <div className="flex justify-between">
            <div>Baskets subtotal</div>
            <div>₱{computeReceipt.basketSubtotal.toFixed(2)}</div>
          </div>
          {/* VAT */}
          <div className="flex justify-between">
            <div>VAT ({(PRICING.taxRate * 100).toFixed(0)}%)</div>
            <div>₱{computeReceipt.taxIncluded.toFixed(2)}</div>
          </div>

          {/* Total */}
          <div className="flex justify-between font-semibold text-lg mt-2">
            <div>Total: </div> <div> ₱{computeReceipt.total.toFixed(2)}</div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 py-3 rounded bg-indigo-600 text-white"
            onClick={() => setShowConfirm(true)}
          >
            Checkout
          </button>
          <button
            className="flex-1 py-3 rounded border"
            onClick={() => resetPOS()}
          >
            Clear All
          </button>
        </div>
      </div>
    </aside>
  );
}
