"use client";

import React from "react";
import { Basket } from "../logic/types";

type Props = {
  baskets: Basket[];
  activeBasketIndex: number;
  updateActiveBasket: (p: Partial<Basket>) => void;
  duplicateActiveBasket: () => void;
};

export default function PaneBaskets({
  baskets,
  activeBasketIndex,
  updateActiveBasket,
  duplicateActiveBasket,
}: Props) {
  const b = baskets[activeBasketIndex];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-4">{b?.name ?? "Basket"}</h2>
        <div className="text-sm text-gray-500">
          Adjust services for this basket
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() =>
            updateActiveBasket({ weightKg: Math.max(0.1, b.weightKg - 0.5) })
          }
        >
          <div className="text-2xl">−</div>
          <div className="text-sm mt-2">Weight</div>
          <div className="text-xs text-gray-500">
            {b.weightKg.toFixed(1)} kg
          </div>
        </div>
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() =>
            updateActiveBasket({ weightKg: +(b.weightKg + 0.5).toFixed(1) })
          }
        >
          <div className="text-2xl">+</div>
          <div className="text-sm mt-2">Weight</div>
        </div>

        {/* Wash controls */}
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() =>
            updateActiveBasket({ washCount: Math.max(0, b.washCount - 1) })
          }
        >
          <div className="text-2xl">−</div>
          <div className="text-sm mt-2">Wash</div>
          <div className="text-xs text-gray-500">{b.washCount}</div>
        </div>
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() => updateActiveBasket({ washCount: b.washCount + 1 })}
        >
          <div className="text-2xl">+</div>
          <div className="text-sm mt-2">Wash</div>
        </div>
        <div
          className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${b.washPremium ? "bg-yellow-100" : "hover:bg-gray-50"}`}
          onClick={() => updateActiveBasket({ washPremium: !b.washPremium })}
        >
          <div className="text-sm">Premium</div>
          <div className="text-xs text-gray-500">Wash</div>
        </div>

        {/* Dry */}
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() =>
            updateActiveBasket({ dryCount: Math.max(0, b.dryCount - 1) })
          }
        >
          <div className="text-2xl">−</div>
          <div className="text-sm mt-2">Dry</div>
          <div className="text-xs text-gray-500">{b.dryCount}</div>
        </div>
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() => updateActiveBasket({ dryCount: b.dryCount + 1 })}
        >
          <div className="text-2xl">+</div>
          <div className="text-sm mt-2">Dry</div>
        </div>
        <div
          className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${b.dryPremium ? "bg-yellow-100" : "hover:bg-gray-50"}`}
          onClick={() => updateActiveBasket({ dryPremium: !b.dryPremium })}
        >
          <div className="text-sm">Premium</div>
          <div className="text-xs text-gray-500">Dry</div>
        </div>

        {/* Spin */}
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() =>
            updateActiveBasket({ spinCount: Math.max(0, b.spinCount - 1) })
          }
        >
          <div className="text-2xl">−</div>
          <div className="text-sm mt-2">Spin</div>
          <div className="text-xs text-gray-500">{b.spinCount}</div>
        </div>
        <div
          className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
          onClick={() => updateActiveBasket({ spinCount: b.spinCount + 1 })}
        >
          <div className="text-2xl">+</div>
          <div className="text-sm mt-2">Spin</div>
        </div>

        {/* Iron */}
        <div
          className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${b.iron ? "bg-blue-50" : "hover:bg-gray-50"}`}
          onClick={() => updateActiveBasket({ iron: !b.iron })}
        >
          <div className="text-sm">Iron</div>
        </div>

        {/* Fold */}
        <div
          className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${b.fold ? "bg-blue-50" : "hover:bg-gray-50"}`}
          onClick={() => updateActiveBasket({ fold: !b.fold })}
        >
          <div className="text-sm">Fold</div>
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={b.notes}
          onChange={(e) => updateActiveBasket({ notes: e.target.value })}
          className="w-full border rounded px-3 py-3"
          rows={3}
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="px-4 py-3 rounded bg-indigo-600 text-white"
          onClick={() => alert("Basket updated (mock)")}
        >
          Apply
        </button>

        <button
          className="px-4 py-3 rounded border"
          onClick={duplicateActiveBasket}
        >
          Duplicate Basket
        </button>
      </div>
    </div>
  );
}
