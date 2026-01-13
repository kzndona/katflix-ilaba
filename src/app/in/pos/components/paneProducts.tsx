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
                className={`col-span-1 p-3 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition shadow-md ${
                  count === 0
                    ? "bg-gray-100 opacity-40 pointer-events-none border border-gray-300"
                    : "bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 hover:shadow-lg hover:from-red-100 hover:to-red-150"
                }`}
                onClick={() => removeProduct(p.id)}
                title={`Remove one ${p.item_name}`}
              >
                <div className="text-2xl font-bold mb-3 text-red-600">−</div>
                <div className="text-sm font-bold text-center mb-2 text-gray-900">
                  {p.item_name}
                </div>
                <div className="text-xs font-semibold text-red-700">({count})</div>
              </div>

              <div
                className="col-span-1 p-3 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition shadow-md bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 hover:shadow-lg hover:from-green-100 hover:to-green-150"
                onClick={() => addProduct(p.id)}
                title={`Add one ${p.item_name}`}
              >
                <div className="text-2xl font-bold mb-3 text-green-600">+</div>
                <div className="text-sm font-bold text-center mb-2 text-gray-900">
                  {p.item_name}
                </div>
                <div className="text-xs font-semibold text-green-700">₱{p.unit_price}</div>
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
