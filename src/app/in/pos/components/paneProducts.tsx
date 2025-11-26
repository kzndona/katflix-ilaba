"use client";

import React from "react";
import { Product } from "../logic/types";

type Props = {
  products: Product[];
  orderProductCounts: Record<string, number>;
  addProduct: (id: string) => void;
  removeProduct: (id: string) => void;
};

export default function PaneProducts({
  products,
  orderProductCounts,
  addProduct,
  removeProduct,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-4">Products</h2>
        <div className="text-sm text-gray-500">Touch-friendly grid</div>
      </div>

      <div className="grid grid-cols-8 gap-3">
        {products.map((p) => {
          const count = orderProductCounts[p.id] || 0;
          return (
            <React.Fragment key={p.id}>
              <div
                className={`col-span-1 p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${
                  count === 0
                    ? "opacity-40 pointer-events-none"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => removeProduct(p.id)}
                title={`Remove one ${p.name} (disabled at 0)`}
              >
                <div className="w-16 h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-2xl">
                  −
                </div>
                <div className="text-sm text-center">Remove</div>
                <div className="text-xs text-gray-500 mt-1">({count})</div>
              </div>

              <div
                className="col-span-1 p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                onClick={() => addProduct(p.id)}
                title={`Add one ${p.name}`}
              >
                <div className="w-16 h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-2xl">
                  +
                </div>
                <div className="text-sm text-center">{p.name}</div>
                <div className="text-xs text-gray-500 mt-1">₱{p.price}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium mb-2">
          Order product summary (mock):
        </div>
        <div className="space-y-2">
          {Object.entries(orderProductCounts).length === 0 && (
            <div className="text-xs text-gray-500">No products added</div>
          )}
          {Object.entries(orderProductCounts).map(([pid, qty]) => {
            const p = products.find((x) => x.id === pid)!;
            return (
              <div key={pid} className="flex justify-between text-sm">
                <div>
                  {p.name} × {qty}
                </div>
                <div>₱{p.price * qty}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
