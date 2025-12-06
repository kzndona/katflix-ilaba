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
    <aside className="bg-white border-r border-gray-200 p-4 flex flex-col h-full rounded-lg">
      <div className="space-y-2">
        <button
          onClick={() => setActivePane("customer")}
          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
            activePane === "customer"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          Customer
        </button>

        <button
          onClick={() => setActivePane("handling")}
          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
            activePane === "handling"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          Pickup & Delivery
        </button>

        <button
          onClick={() => setActivePane("products")}
          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
            activePane === "products"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          Products
        </button>
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Baskets
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {baskets.map((b, i) => (
            <button
              key={b.id}
              onClick={() => {
                setActivePane("basket");
                setActiveBasketIndex(i);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg flex justify-between items-center text-sm transition ${
                activePane === "basket" && activeBasketIndex === i
                  ? "bg-blue-100 border border-blue-300"
                  : "hover:bg-gray-100"
              }`}
            >
              <div>
                <div className="font-medium text-gray-900">{b.name}</div>
                <div className="text-xs text-gray-500">
                  {b.weightKg.toFixed(1)} kg • W{b.washCount} • D{b.dryCount}
                </div>
              </div>
              <div className="text-xs text-gray-400">#{i + 1}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={addBasket}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
          >
            + Add
          </button>
          {baskets.length > 1 && (
            <button
              onClick={() => deleteBasket(activeBasketIndex)}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
