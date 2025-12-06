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
      <h2 className="text-xl font-bold text-gray-900 mb-6">Products</h2>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {products.map((p) => {
          const count = orderProductCounts[p.id] || 0;
          return (
            <React.Fragment key={p.id}>
              <div
                className={`col-span-1 p-3 border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition ${
                  count === 0
                    ? "opacity-40 pointer-events-none"
                    : "hover:border-red-500 hover:bg-red-50"
                }`}
                onClick={() => removeProduct(p.id)}
                title={`Remove one ${p.item_name}`}
              >
                <div className="w-16 h-16 bg-red-100 rounded-lg mb-2 flex items-center justify-center text-3xl text-red-600">
                  −
                </div>
                <div className="text-sm text-center font-medium text-gray-900">
                  Remove
                </div>
                <div className="text-xs text-gray-600 mt-1 font-semibold">
                  ({count})
                </div>
              </div>

              <div
                className="col-span-1 p-3 border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none hover:border-green-500 hover:bg-green-50 transition"
                onClick={() => addProduct(p.id)}
                title={`Add one ${p.item_name}`}
              >
                <div className="w-16 h-16 bg-green-100 rounded-lg mb-2 flex items-center justify-center text-3xl text-green-600">
                  +
                </div>
                <div className="text-sm text-center font-medium text-gray-900">
                  {p.item_name}
                </div>
                <div className="text-xs text-gray-600 mt-1 font-semibold">
                  ₱{p.unit_price}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {Object.entries(orderProductCounts).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-sm font-semibold text-gray-900 mb-3">
            Selected Products
          </div>
          <div className="space-y-2">
            {Object.entries(orderProductCounts).map(([pid, qty]) => {
              const p = products.find((x) => x.id === pid)!;
              return (
                <div key={pid} className="flex justify-between text-sm">
                  <div className="text-gray-700">
                    {p.item_name} <span className="text-gray-500">× {qty}</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    ₱{(p.unit_price * qty).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
