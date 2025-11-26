"use client";

import React from "react";

type Props = {
  activePane: string;
  setActivePane: (p: any) => void;
  baskets: any[];
  activeBasketIndex: number;
  setActiveBasketIndex: (i: number) => void;
  addBasket: () => void;
  deleteBasket: (i: number) => void;
};

export default function SidebarTabs({
  activePane,
  setActivePane,
  baskets,
  activeBasketIndex,
  setActiveBasketIndex,
  addBasket,
  deleteBasket,
}: Props) {
  return (
    <aside className="bg-white border rounded-xl p-3 flex flex-col min-h-[600px]">
      <div className="space-y-2">
        <button
          onClick={() => setActivePane("customer")}
          className={`w-full text-left px-4 py-3 rounded text-base ${
            activePane === "customer" ? "bg-indigo-100" : "hover:bg-gray-100"
          }`}
        >
          Customer
        </button>

        <button
          onClick={() => setActivePane("handling")}
          className={`w-full text-left px-4 py-3 rounded text-base ${
            activePane === "handling" ? "bg-indigo-100" : "hover:bg-gray-100"
          }`}
        >
          Pickup & Delivery
        </button>

        <button
          onClick={() => setActivePane("products")}
          className={`w-full text-left px-4 py-3 rounded text-base ${
            activePane === "products" ? "bg-indigo-100" : "hover:bg-gray-100"
          }`}
        >
          Products
        </button>
      </div>

      <hr className="my-3" />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="text-xs font-semibold text-gray-500 mb-2">Baskets</div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {baskets.map((b, i) => (
            <button
              key={b.id}
              onClick={() => {
                setActivePane("basket");
                setActiveBasketIndex(i);
              }}
              className={`w-full text-left px-3 py-3 rounded flex justify-between items-center text-sm ${
                activePane === "basket" && activeBasketIndex === i
                  ? "bg-indigo-100"
                  : "hover:bg-gray-100"
              }`}
            >
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-gray-500">
                  {b.weightKg.toFixed(1)} kg • Wash {b.washCount} • Dry{" "}
                  {b.dryCount}
                </div>
              </div>
              <div className="text-xs text-gray-400">#{i + 1}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={addBasket}
            className="flex-1 py-3 rounded bg-green-600 text-white text-sm hover:brightness-95"
          >
            + Add Basket
          </button>
          <button
            onClick={() => deleteBasket(activeBasketIndex)}
            className="flex-1 py-3 rounded bg-red-600 text-white text-sm disabled:opacity-50"
            disabled={baskets.length === 1}
          >
            Delete
          </button>
        </div>
      </div>
    </aside>
  );
}
