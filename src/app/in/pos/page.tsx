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

  // Auto-clear customer if search results exist but no selection after delay
  React.useEffect(() => {
    if (
      pos.customerQuery &&
      pos.customerSuggestions.length > 0 &&
      !pos.customer
    ) {
      const timer = setTimeout(() => {
        if (
          pos.customerQuery &&
          !pos.customer &&
          pos.customerSuggestions.length > 0
        ) {
          // User typed but didn't select from suggestions, so clear it
          clearCustomer();
        }
      }, 3000); // 3 seconds delay

      return () => clearTimeout(timer);
    }
  }, [pos.customerQuery, pos.customerSuggestions, pos.customer]);

  const createNewBasket = () => {
    pos.addBasket();
    pos.setActiveBasketIndex(pos.baskets.length);
  };

  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900 overflow-hidden">
      <div className="h-full w-full p-4 grid grid-cols-[260px_1fr_420px] gap-4">
        <SidebarTabs
          activePane={pos.activePane}
          setActivePane={pos.setActivePane}
          baskets={pos.baskets}
          activeBasketIndex={pos.activeBasketIndex}
          setActiveBasketIndex={pos.setActiveBasketIndex}
          addBasket={pos.addBasket}
          deleteBasket={pos.deleteBasket}
          customer={pos.customer}
        />

        <main className="bg-white border border-gray-100 rounded-lg p-6 overflow-auto h-full">
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
              services={pos.services}
            />
          )}
        </main>

        <PaneReceipt
          customer={pos.customer}
          computeReceipt={pos.computeReceipt}
          handling={pos.handling}
          setShowConfirm={pos.setShowConfirm}
          saveOrder={pos.saveOrder}
          resetPOS={pos.resetPOS}
        />
      </div>

      {pos.showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white rounded-xl p-6 w-[520px]">
            <h3 className="text-lg font-semibold">
              Confirm Checkout & Process Payment
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Total: <strong>₱{pos.computeReceipt.total.toFixed(2)}</strong>
            </p>

            {/* Payment Method */}
            <div className="mt-5 border-t pt-4">
              <div className="font-medium text-sm mb-3">Payment Method</div>
              <div className="space-y-3">
                {/* Cash Option */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={pos.payment.method === "cash"}
                    onChange={(e) =>
                      pos.setPayment({ ...pos.payment, method: "cash" })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Cash</div>
                    {pos.payment.method === "cash" && (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Amount:</span>
                          <span className="font-medium">
                            ₱{pos.computeReceipt.total.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1">
                            Amount Paid
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={pos.payment.amountPaid || ""}
                            onChange={(e) =>
                              pos.setPayment({
                                ...pos.payment,
                                amountPaid: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </div>
                        {pos.payment.amountPaid !== undefined &&
                          pos.payment.amountPaid >= 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span>Change:</span>
                              <span className="font-medium">
                                ₱
                                {(
                                  pos.payment.amountPaid -
                                  pos.computeReceipt.total
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </label>

                {/* GCash Option */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    checked={pos.payment.method === "gcash"}
                    onChange={(e) =>
                      pos.setPayment({
                        ...pos.payment,
                        method: "gcash",
                        amountPaid: undefined,
                      })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">GCash</div>
                    {pos.payment.method === "gcash" && (
                      <div className="mt-3">
                        <label className="block text-sm text-gray-600 mb-1">
                          Reference Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., GC123456789"
                          value={pos.payment.referenceNumber || ""}
                          onChange={(e) =>
                            pos.setPayment({
                              ...pos.payment,
                              referenceNumber: e.target.value,
                            })
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => pos.setShowConfirm(false)}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 text-white disabled:bg-gray-400"
                disabled={
                  pos.isProcessing ||
                  (pos.payment.method === "cash" &&
                    (!pos.payment.amountPaid ||
                      pos.payment.amountPaid < pos.computeReceipt.total)) ||
                  (pos.payment.method === "gcash" &&
                    !pos.payment.referenceNumber)
                }
                onClick={async () => {
                  await pos.saveOrder();
                }}
              >
                {pos.isProcessing ? "Processing..." : "Process Payment & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
