"use client";

import React from "react";
import { usePOSState } from "./logic/usePOSState";
import SidebarTabs from "./components/sidebarTabs";
import PaneCustomer from "./components/paneCustomer";
import PaneHandling from "./components/paneHandling";
import PaneBaskets from "./components/paneBaskets";
import PaneProducts from "./components/paneProducts";
import PaneReceipt from "./components/paneReceipt";

export default function POSPage() {
  const pos = usePOSState();

  // helper to pick customer from suggestions
  const pickCustomer = (c: any) => {
    pos.setCustomer(c);
    pos.setCustomerQuery(`${c.first_name} ${c.last_name}`);
    pos.setCustomerSuggestions([]);
  };

  const clearCustomer = () => {
    pos.setCustomer(null);
    pos.setCustomerQuery("");
    pos.setCustomerSuggestions([]);
  };

  const createNewBasket = () => {
    pos.addBasket();
    pos.setActiveBasketIndex(pos.baskets.length);
  };

  return (
    <div className="h-screen w-full bg-white text-gray-900">
      <div className="h-full max-w-[1600px] mx-auto p-4 grid grid-cols-[260px_1fr_420px] gap-4">
        <SidebarTabs
          activePane={pos.activePane}
          setActivePane={pos.setActivePane}
          baskets={pos.baskets}
          activeBasketIndex={pos.activeBasketIndex}
          setActiveBasketIndex={pos.setActiveBasketIndex}
          addBasket={pos.addBasket}
          deleteBasket={pos.deleteBasket}
        />

        <main className="bg-white border rounded-xl p-5 overflow-auto">
          {pos.activePane === "customer" && (
            <PaneCustomer
              customer={pos.customer}
              setCustomer={pos.setCustomer}
              customerQuery={pos.customerQuery}
              setCustomerQuery={pos.setCustomerQuery}
              customerSuggestions={pos.customerSuggestions}
              pickCustomer={pickCustomer}
              clearCustomer={clearCustomer}
            />
          )}

          {pos.activePane === "handling" && (
            <PaneHandling
              handling={pos.handling}
              setHandling={pos.setHandling}
            />
          )}

          {pos.activePane === "products" && (
            <PaneProducts
              products={pos.products}
              orderProductCounts={pos.orderProductCounts}
              addProduct={pos.addProduct}
              removeProduct={pos.removeProduct}
            />
          )}

          {pos.activePane === "basket" && (
            <PaneBaskets
              baskets={pos.baskets}
              activeBasketIndex={pos.activeBasketIndex}
              updateActiveBasket={pos.updateActiveBasket}
              deleteActiveBasket={pos.deleteBasket}
              createNewBasket={createNewBasket}
            />
          )}
        </main>

        <PaneReceipt
          customer={pos.customer}
          computeReceipt={pos.computeReceipt}
          handling={pos.handling}
          setShowConfirm={pos.setShowConfirm}
          setOrderProductCounts={pos.orderProductCounts as any}
          setBaskets={pos.baskets as any}
          setActiveBasketIndex={pos.setActiveBasketIndex}
          saveOrder={pos.saveOrder}
        />
      </div>

      {pos.showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white rounded-xl p-6 w-[480px]">
            <h3 className="text-lg font-semibold">Confirm checkout (mock)</h3>
            <p className="text-sm text-gray-600 mt-2">
              This will simulate saving the order (mock). Price shown:{" "}
              <strong>₱{pos.computeReceipt.total.toFixed(2)}</strong>
            </p>

            <div className="mt-4 flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => pos.setShowConfirm(false)}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 text-white"
                onClick={async () => {
                  pos.setShowConfirm(false);
                  await pos.saveOrder();
                }}
              >
                Confirm & Save (mock)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
