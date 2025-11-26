"use client";

import React from "react";
import { PRICING } from "../logic/usePOSState";

type Props = {
  customer: any;
  computeReceipt: any;
  handling: any;
  setShowConfirm: (v: boolean) => void;
  setOrderProductCounts: (o: any) => void;
  setBaskets: (b: any) => void;
  setActiveBasketIndex: (i: number) => void;
  saveOrder: () => Promise<void>;
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
}: Props) {
  return (
    <aside className="bg-white border rounded-xl p-5 overflow-auto min-h-[600px]">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">Receipt</h3>
        <div className="text-xs text-gray-500">Thermal preview</div>
      </div>

      <div className="mt-3 text-sm text-gray-700">
        <div>
          <strong>Customer:</strong>{" "}
          {customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`
            : "Guest"}
        </div>
        <div className="text-xs text-gray-500">
          Pickup / Delivery info shown here
        </div>
      </div>

      <hr className="my-3" />

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
              <div>₱{pl.lineTotal}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 font-medium mb-2">Baskets</div>
        <div className="space-y-2">
          {computeReceipt.basketLines.map((b: any) => (
            <div key={b.id} className="flex justify-between text-sm">
              <div>
                <div className="font-medium">
                  {b.name} • {b.weightKg} kg
                </div>
                <div className="text-xs text-gray-500">
                  wash{" "}
                  {b.breakdown.wash > 0
                    ? `₱${b.breakdown.wash.toFixed(2)}`
                    : "—"}{" "}
                  • dry{" "}
                  {b.breakdown.dry > 0
                    ? ` ₱${b.breakdown.dry.toFixed(2)}`
                    : " —"}{" "}
                  • spin{" "}
                  {b.breakdown.spin > 0
                    ? ` ₱${b.breakdown.spin.toFixed(2)}`
                    : " —"}
                </div>
              </div>
              <div>₱{b.total.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <div>Products subtotal</div>
            <div>₱{computeReceipt.productSubtotal.toFixed(2)}</div>
          </div>
          <div className="flex justify-between">
            <div>Baskets subtotal</div>
            <div>₱{computeReceipt.basketSubtotal.toFixed(2)}</div>
          </div>
          <div className="flex justify-between">
            <div>Service fee</div>
            <div>₱{computeReceipt.fee.toFixed(2)}</div>
          </div>
          <div className="flex justify-between">
            <div>Tax ({(PRICING.taxRate * 100).toFixed(0)}%)</div>
            <div>₱{computeReceipt.tax.toFixed(2)}</div>
          </div>
          <div className="flex justify-between font-semibold text-lg mt-3">
            <div>Total</div>
            <div>₱{computeReceipt.total.toFixed(2)}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 py-3 rounded bg-indigo-600 text-white"
            onClick={() => setShowConfirm(true)}
          >
            Checkout
          </button>
          <button
            className="flex-1 py-3 rounded border"
            onClick={() => {
              setOrderProductCounts({});
              setBaskets([
                {
                  id: "b0",
                  name: "Basket 1",
                  weightKg: 3,
                  washCount: 1,
                  dryCount: 0,
                  spinCount: 0,
                  washPremium: false,
                  dryPremium: false,
                  iron: false,
                  fold: false,
                  notes: "",
                },
              ]);
              setActiveBasketIndex(0);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </aside>
  );
}
