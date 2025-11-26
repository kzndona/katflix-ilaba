"use client";

import React from "react";

type Props = {
  handling: any;
  setHandling: (h: any) => void;
};

export default function PaneHandling({ handling, setHandling }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Pickup & Delivery</h2>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={handling.pickup}
              onChange={() =>
                setHandling({ ...handling, pickup: !handling.pickup })
              }
            />
            <span className="text-base">Pickup at Store</span>
          </label>
        </div>

        <div>
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={handling.deliver}
              onChange={() =>
                setHandling({ ...handling, deliver: !handling.deliver })
              }
            />
            <span className="text-base">Deliver to Customer</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Pickup address (optional)
          </label>
          <input
            className="w-full border rounded px-3 py-3"
            value={handling.pickupAddress}
            onChange={(e) =>
              setHandling({ ...handling, pickupAddress: e.target.value })
            }
            placeholder="Store pickup location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Delivery address
          </label>
          <input
            className="w-full border rounded px-3 py-3"
            value={handling.deliveryAddress}
            onChange={(e) =>
              setHandling({ ...handling, deliveryAddress: e.target.value })
            }
            placeholder="Customer delivery address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Delivery fee</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-3"
            value={handling.deliveryFee}
            onChange={(e) =>
              setHandling({
                ...handling,
                deliveryFee: Number(e.target.value || 0),
              })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Courier / Ref
          </label>
          <input
            className="w-full border rounded px-3 py-3"
            value={handling.courierRef}
            onChange={(e) =>
              setHandling({ ...handling, courierRef: e.target.value })
            }
            placeholder="Courier name / reference"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Instructions</label>
          <textarea
            rows={3}
            className="w-full border rounded px-3 py-3"
            value={handling.instructions}
            onChange={(e) =>
              setHandling({ ...handling, instructions: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}
