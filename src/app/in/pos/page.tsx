"use client";
import React, { useMemo, useState } from "react";

/**
 * POS Placeholder UI (TypeScript + Tailwind)
 *
 * - Desktop + light mode only.
 * - Vertical tabs on the left: Customer, Products, then a scrollable list of Basket buttons.
 * - Center pane: customer form / products grid / basket controls (switches panes).
 * - Right pane: Receipt preview (auto-updates).
 * - Product tiles: 2 tiles per DB product (Remove [-1], Add [+1]) — Remove disabled at 0.
 * - Basket tiles:
 *    Weight: - / +
 *    Wash: - / + / Premium (toggle)
 *    Dry: - / + / Premium (toggle)
 *    Spin: - / +
 *    Iron: toggle
 *    Fold: toggle
 * - All pricing is local/mock. API stubs commented out for future integration.
 *
 * Notes:
 * - This is a UI mock with local state. Replace mocked sections with real API calls later.
 * - Grid is 4 columns horizontally for products.
 */

/* -------------------------
   Type definitions
   ------------------------- */
type Product = {
  id: string;
  name: string;
  price: number; // per unit
  imageUrl?: string | null;
};

type Customer = {
  id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthdate?: string;
  gender?: "male" | "female" | "";
  address?: string;
  phone_number?: string;
  email_address?: string;
};

type Basket = {
  id: string;
  name: string;
  // productsCounts are global order-level products, but we keep basket-level productCounts optional
  weightKg: number;
  washCount: number;
  washPremium: boolean;
  dryCount: number;
  dryPremium: boolean;
  spinCount: number;
  iron: boolean;
  fold: boolean;
  notes?: string;
};

export default function PosPlaceholder() {
  /* -------------------------
     Mocked initial data
     ------------------------- */
  const initialProducts: Product[] = [
    { id: "p_hma_det", name: "HMA Detergent", price: 120, imageUrl: null },
    { id: "p_soft", name: "Fabric Softener", price: 80, imageUrl: null },
    { id: "p_bleach", name: "Bleach", price: 95, imageUrl: null },
    { id: "p_mesh_bag", name: "Mesh Bag", price: 150, imageUrl: null },
    { id: "p_perfume", name: "Scent Booster", price: 60, imageUrl: null },
    { id: "p_stain_rem", name: "Stain Remover", price: 200, imageUrl: null },
    { id: "p_deluxe_bag", name: "Deluxe Bag", price: 350, imageUrl: null },
    { id: "p_laundry_tag", name: "Laundry Tag", price: 15, imageUrl: null },
  ];

  // Pricing model for basket services (mock)
  const PRICING = {
    washPerKg: 45, // base wash price per kg
    washPremiumAddPerKg: 20, // extra per kg if premium
    dryPerKg: 30,
    dryPremiumAddPerKg: 15,
    spinPerUnit: 10,
    ironFlat: 25,
    foldFlat: 10,
    taxRate: 0.12, // 12% tax
    serviceFee: 25, // flat fee per order
  };

  /* -------------------------
     UI state
     ------------------------- */
  const [activePane, setActivePane] = useState<
    "customer" | "products" | "basket"
  >("customer");

  // Customer & live-search (mocked suggestions)
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>(
    []
  );
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Products in the store
  const [products] = useState<Product[]>(initialProducts);

  // Order-level products counts (the product add/remove tiles modify this)
  const [orderProductCounts, setOrderProductCounts] = useState<
    Record<string, number>
  >({});

  // Baskets array (starts with 1)
  const newBasket = (idx: number): Basket => ({
    id: `b${Date.now()}_${idx}`,
    name: `Basket ${idx + 1}`,
    weightKg: 1.0,
    washCount: 0,
    washPremium: false,
    dryCount: 0,
    dryPremium: false,
    spinCount: 0,
    iron: false,
    fold: false,
    notes: "",
  });
  const [baskets, setBaskets] = useState<Basket[]>([newBasket(0)]);
  const [activeBasketIndex, setActiveBasketIndex] = useState(0);

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);

  /* -------------------------
     Mocked live search function
     ------------------------- */
  function runCustomerSearch(q: string) {
    setCustomerQuery(q);
    if (!q.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    // Mocked suggestion set:
    const demo: Customer[] = [
      {
        id: "c1",
        first_name: "Juan",
        middle_name: "D",
        last_name: "Dela Cruz",
        phone_number: "0917-000-0000",
        email_address: "juan@example.com",
        address: "Makati City",
        gender: "male",
        birthdate: "1990-01-01",
      },
      {
        id: "c2",
        first_name: "Maria",
        middle_name: "S",
        last_name: "Santos",
        phone_number: "0918-111-1111",
        email_address: "maria@example.com",
        address: "Quezon City",
        gender: "female",
        birthdate: "1995-05-05",
      },
    ];

    const matches = demo.filter((d) =>
      `${d.first_name} ${d.last_name}`.toLowerCase().includes(q.toLowerCase())
    );
    setCustomerSuggestions(matches);
  }

  function pickCustomer(s: Customer) {
    setCustomer(s);
    setCustomerSuggestions([]);
    setCustomerQuery(`${s.first_name ?? ""} ${s.last_name ?? ""}`);
  }

  /* -------------------------
     Products add/remove helpers
     ------------------------- */
  function addProduct(id: string) {
    setOrderProductCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }
  function removeProduct(id: string) {
    setOrderProductCounts((prev) => {
      const cur = prev[id] || 0;
      if (cur <= 1) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: cur - 1 };
    });
  }

  /* -------------------------
     Basket helpers
     ------------------------- */
  function updateActiveBasket(patch: Partial<Basket>) {
    setBaskets((prev) => {
      const copy = prev.map((b) => ({ ...b }));
      copy[activeBasketIndex] = { ...copy[activeBasketIndex], ...patch };
      return copy;
    });
  }

  function addBasket() {
    setBaskets((prev) => {
      const next = [...prev, newBasket(prev.length)];
      return next;
    });
    setActivePane("basket");
    setActiveBasketIndex(baskets.length); // new one becomes active
  }

  function deleteBasket(index: number) {
    if (baskets.length === 1) return; // keep at least one
    setBaskets((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      return copy;
    });
    setActiveBasketIndex((i) => Math.max(0, index - 1));
  }

  /* -------------------------
     Pricing / receipt calculations
     ------------------------- */
  const receipt = useMemo(() => {
    // Product totals
    const productLines = Object.entries(orderProductCounts).map(
      ([pid, qty]) => {
        const prod = products.find((p) => p.id === pid)!;
        return {
          id: pid,
          name: prod.name,
          qty,
          price: prod.price,
          lineTotal: prod.price * qty,
        };
      }
    );
    const productSubtotal = productLines.reduce((s, l) => s + l.lineTotal, 0);

    // Basket totals (sum across baskets)
    let basketSubtotal = 0;
    const basketLines = baskets.map((b) => {
      const wash = b.weightKg * PRICING.washPerKg * b.washCount;
      const washPremium = b.washPremium
        ? b.weightKg * PRICING.washPremiumAddPerKg * b.washCount
        : 0;
      const dry = b.weightKg * PRICING.dryPerKg * b.dryCount;
      const dryPremium = b.dryPremium
        ? b.weightKg * PRICING.dryPremiumAddPerKg * b.dryCount
        : 0;
      const spin = b.spinCount * PRICING.spinPerUnit;
      const iron = b.iron ? PRICING.ironFlat : 0;
      const fold = b.fold ? PRICING.foldFlat : 0;

      const total = wash + washPremium + dry + dryPremium + spin + iron + fold;
      basketSubtotal += total;
      return {
        id: b.id,
        name: b.name,
        weightKg: b.weightKg,
        total,
        breakdown: { wash, washPremium, dry, dryPremium, spin, iron, fold },
      };
    });

    const subtotal = productSubtotal + basketSubtotal;
    const fee = PRICING.serviceFee;
    const tax = (subtotal + fee) * PRICING.taxRate;
    const total = subtotal + fee + tax;

    return {
      productLines,
      basketLines,
      productSubtotal,
      basketSubtotal,
      subtotal,
      fee,
      tax,
      total,
    };
  }, [orderProductCounts, baskets, products]);

  /* -------------------------
     Mocked API stubs (commented out)
     ------------------------- */
  /*
  async function fetchProductsFromApi() {
    // const res = await fetch('/api/products');
    // const data = await res.json();
    // setProducts(data);
  }

  async function searchCustomersApi(query: string) {
    // const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
    // return await res.json();
  }

  async function fetchServicesApi() {
    // const res = await fetch('/api/services');
    // return await res.json();
  }

  async function saveOrderApi(payload: any) {
    // const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    // return await res.json();
  }
  */

  /* -------------------------
     UI Rendering
     ------------------------- */
  return (
    <div className="h-screen w-full bg-white text-gray-900">
      <div className="h-full max-w-[1600px] mx-auto p-4 grid grid-cols-[240px_1fr_380px] gap-4">
        {/* LEFT - Tabs */}
        <aside className="bg-white border rounded-xl p-3 flex flex-col">
          <div className="space-y-2">
            <button
              onClick={() => setActivePane("customer")}
              className={`w-full text-left px-3 py-2 rounded ${activePane === "customer" ? "bg-indigo-100" : "hover:bg-gray-100"}`}
            >
              Customer
            </button>

            <button
              onClick={() => setActivePane("products")}
              className={`w-full text-left px-3 py-2 rounded ${activePane === "products" ? "bg-indigo-100" : "hover:bg-gray-100"}`}
            >
              Products
            </button>
          </div>

          <hr className="my-3" />

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Baskets
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {baskets.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActivePane("basket");
                    setActiveBasketIndex(i);
                  }}
                  className={`w-full text-left px-3 py-2 rounded flex justify-between items-center ${
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
                className="flex-1 py-2 rounded bg-green-600 text-white text-sm hover:brightness-95"
              >
                + Add Basket
              </button>
              <button
                onClick={() => deleteBasket(activeBasketIndex)}
                className="flex-1 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-50"
                disabled={baskets.length === 1}
              >
                Delete
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER - Forms Pane */}
        <main className="bg-white border rounded-xl p-5 overflow-auto">
          {/* CUSTOMER PANE */}
          {activePane === "customer" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Customer</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Search or type name
                  </label>
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={(e) => runCustomerSearch(e.target.value)}
                    placeholder="Live search — matches will appear as you type"
                    className="w-full border rounded px-3 py-2"
                  />
                  {/* Suggestions */}
                  {customerSuggestions.length > 0 && (
                    <div className="mt-2 border rounded shadow-sm bg-white max-h-44 overflow-auto">
                      {customerSuggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => pickCustomer(s)}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <div className="font-medium">
                            {s.first_name} {s.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {s.phone_number}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    First name
                  </label>
                  <input
                    value={customer?.first_name ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        first_name: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Middle name
                  </label>
                  <input
                    value={customer?.middle_name ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        middle_name: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Last name
                  </label>
                  <input
                    value={customer?.last_name ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        last_name: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Birthdate
                  </label>
                  <input
                    type="date"
                    value={customer?.birthdate ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        birthdate: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Gender
                  </label>
                  <select
                    value={customer?.gender ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        gender: (e.target.value as any) ?? "",
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">--</option>
                    <option value="male">male</option>
                    <option value="female">female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone
                  </label>
                  <input
                    value={customer?.phone_number ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        phone_number: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    value={customer?.email_address ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        email_address: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Address
                  </label>
                  <textarea
                    value={customer?.address ?? ""}
                    onChange={(e) =>
                      setCustomer({
                        ...(customer ?? {}),
                        address: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                {/* Pickup / Delivery toggles */}
                <div className="col-span-2 grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!customer?.address}
                        onChange={() => {
                          // purely UI: toggles are managed by the address field; keep it simple here
                          if (!customer?.address)
                            setCustomer({ ...(customer ?? {}), address: "" });
                        }}
                      />
                      <span className="text-sm">Pickup at Store</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 mt-2"
                      placeholder="Pickup address (optional)"
                    />
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" />
                      <span className="text-sm">Deliver to Customer</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 mt-2"
                      placeholder="Delivery address (if selected)"
                    />
                  </div>
                </div>

                <div className="col-span-2 mt-4 flex gap-3">
                  <button
                    className="px-4 py-2 rounded bg-indigo-600 text-white"
                    onClick={() => {
                      // For the mock: save locally
                      // In production: call saveCustomer API
                      // saveCustomerApi(customer)
                      alert("Customer saved (mock)");
                    }}
                  >
                    Save Customer
                  </button>

                  <button
                    className="px-4 py-2 rounded border"
                    onClick={() => {
                      setCustomer(null);
                      setCustomerQuery("");
                      setCustomerSuggestions([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTS PANE */}
          {activePane === "products" && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold mb-4">Products</h2>
                <div className="text-sm text-gray-500">
                  Grid: 4 tiles per row (two tiles per product)
                </div>
              </div>

              <div className="grid grid-cols-8 gap-3">
                {/* We use 8 columns so two tiles per product fit nicely in a 4-product-per-row visual (2 cols per product) */}
                {products.map((p) => {
                  const count = orderProductCounts[p.id] || 0;
                  return (
                    <React.Fragment key={p.id}>
                      {/* Remove tile (decrease by 1) */}
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
                        <div className="text-xs text-gray-500 mt-1">
                          ({count})
                        </div>
                      </div>

                      {/* Add tile (increase by 1) */}
                      <div
                        className="col-span-1 p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                        onClick={() => addProduct(p.id)}
                        title={`Add one ${p.name}`}
                      >
                        <div className="w-16 h-16 bg-gray-100 rounded mb-2 flex items-center justify-center text-2xl">
                          +
                        </div>
                        <div className="text-sm text-center">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          ₱{p.price}
                        </div>
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
                    <div className="text-xs text-gray-500">
                      No products added
                    </div>
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
          )}

          {/* BASKET PANE */}
          {activePane === "basket" && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold mb-4">
                  {baskets[activeBasketIndex]?.name ?? "Basket"}
                </h2>
                <div className="text-sm text-gray-500">
                  Adjust services for this basket
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {/* Weight: decrease / increase */}
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      weightKg: Math.max(
                        0.1,
                        baskets[activeBasketIndex].weightKg - 0.5
                      ),
                    })
                  }
                >
                  <div className="text-2xl">−</div>
                  <div className="text-sm mt-2">Weight</div>
                  <div className="text-xs text-gray-500">
                    {baskets[activeBasketIndex].weightKg.toFixed(1)} kg
                  </div>
                </div>
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      weightKg: +(
                        baskets[activeBasketIndex].weightKg + 0.5
                      ).toFixed(1),
                    })
                  }
                >
                  <div className="text-2xl">+</div>
                  <div className="text-sm mt-2">Weight</div>
                </div>

                {/* Wash: decrease / increase / premium */}
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      washCount: Math.max(
                        0,
                        baskets[activeBasketIndex].washCount - 1
                      ),
                    })
                  }
                >
                  <div className="text-2xl">−</div>
                  <div className="text-sm mt-2">Wash</div>
                  <div className="text-xs text-gray-500">
                    {baskets[activeBasketIndex].washCount}
                  </div>
                </div>
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      washCount: baskets[activeBasketIndex].washCount + 1,
                    })
                  }
                >
                  <div className="text-2xl">+</div>
                  <div className="text-sm mt-2">Wash</div>
                </div>
                <div
                  className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${
                    baskets[activeBasketIndex].washPremium
                      ? "bg-yellow-100"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    updateActiveBasket({
                      washPremium: !baskets[activeBasketIndex].washPremium,
                    })
                  }
                >
                  <div className="text-sm">Premium</div>
                  <div className="text-xs text-gray-500">Wash</div>
                </div>

                {/* Dry: decrease / increase / premium */}
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      dryCount: Math.max(
                        0,
                        baskets[activeBasketIndex].dryCount - 1
                      ),
                    })
                  }
                >
                  <div className="text-2xl">−</div>
                  <div className="text-sm mt-2">Dry</div>
                  <div className="text-xs text-gray-500">
                    {baskets[activeBasketIndex].dryCount}
                  </div>
                </div>
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      dryCount: baskets[activeBasketIndex].dryCount + 1,
                    })
                  }
                >
                  <div className="text-2xl">+</div>
                  <div className="text-sm mt-2">Dry</div>
                </div>
                <div
                  className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${
                    baskets[activeBasketIndex].dryPremium
                      ? "bg-yellow-100"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    updateActiveBasket({
                      dryPremium: !baskets[activeBasketIndex].dryPremium,
                    })
                  }
                >
                  <div className="text-sm">Premium</div>
                  <div className="text-xs text-gray-500">Dry</div>
                </div>

                {/* Spin: - / + */}
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      spinCount: Math.max(
                        0,
                        baskets[activeBasketIndex].spinCount - 1
                      ),
                    })
                  }
                >
                  <div className="text-2xl">−</div>
                  <div className="text-sm mt-2">Spin</div>
                  <div className="text-xs text-gray-500">
                    {baskets[activeBasketIndex].spinCount}
                  </div>
                </div>
                <div
                  className="p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none hover:bg-gray-50"
                  onClick={() =>
                    updateActiveBasket({
                      spinCount: baskets[activeBasketIndex].spinCount + 1,
                    })
                  }
                >
                  <div className="text-2xl">+</div>
                  <div className="text-sm mt-2">Spin</div>
                </div>

                {/* Iron toggle */}
                <div
                  className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${
                    baskets[activeBasketIndex].iron
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    updateActiveBasket({
                      iron: !baskets[activeBasketIndex].iron,
                    })
                  }
                >
                  <div className="text-sm">Iron</div>
                </div>

                {/* Fold toggle */}
                <div
                  className={`p-3 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${
                    baskets[activeBasketIndex].fold
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    updateActiveBasket({
                      fold: !baskets[activeBasketIndex].fold,
                    })
                  }
                >
                  <div className="text-sm">Fold</div>
                </div>
              </div>

              {/* Notes and basket-level controls */}
              <div className="mt-5">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={baskets[activeBasketIndex].notes}
                  onChange={(e) =>
                    setBaskets((prev) => {
                      const copy = prev.map((b) => ({ ...b }));
                      copy[activeBasketIndex].notes = e.target.value;
                      return copy;
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  className="px-4 py-2 rounded bg-indigo-600 text-white"
                  onClick={() => {
                    // Mocked: Mark as updated
                    alert("Basket updated (mock)");
                  }}
                >
                  Apply
                </button>

                <button
                  className="px-4 py-2 rounded border"
                  onClick={() => {
                    // Duplicate basket
                    setBaskets((prev) => {
                      const copy = prev.slice();
                      const b = {
                        ...copy[activeBasketIndex],
                        id: `b${Date.now()}`,
                        name: `Basket ${copy.length + 1}`,
                      };
                      copy.push(b);
                      return copy;
                    });
                  }}
                >
                  Duplicate Basket
                </button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT - Receipt */}
        <aside className="bg-white border rounded-xl p-5 overflow-auto">
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
              {receipt.productLines.length === 0 && (
                <div className="text-xs text-gray-500">
                  No product purchases
                </div>
              )}
              {receipt.productLines.map((pl) => (
                <div key={pl.id} className="flex justify-between">
                  <div>
                    <div className="font-medium">
                      {pl.name} × {pl.qty}
                    </div>
                    <div className="text-xs text-gray-500">
                      ₱{pl.price} each
                    </div>
                  </div>
                  <div>₱{pl.lineTotal}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 font-medium mb-2">Baskets</div>
            <div className="space-y-2">
              {receipt.basketLines.map((b) => (
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
                <div>₱{receipt.productSubtotal.toFixed(2)}</div>
              </div>
              <div className="flex justify-between">
                <div>Baskets subtotal</div>
                <div>₱{receipt.basketSubtotal.toFixed(2)}</div>
              </div>
              <div className="flex justify-between">
                <div>Service fee</div>
                <div>₱{receipt.fee.toFixed(2)}</div>
              </div>
              <div className="flex justify-between">
                <div>Tax ({(PRICING.taxRate * 100).toFixed(0)}%)</div>
                <div>₱{receipt.tax.toFixed(2)}</div>
              </div>
              <div className="flex justify-between font-semibold text-lg mt-3">
                <div>Total</div>
                <div>₱{receipt.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 py-2 rounded bg-indigo-600 text-white"
                onClick={() => setShowConfirm(true)}
              >
                Checkout
              </button>
              <button
                className="flex-1 py-2 rounded border"
                onClick={() => {
                  // cancel / clear order (mock)
                  setOrderProductCounts({});
                  setBaskets([newBasket(0)]);
                  setActiveBasketIndex(0);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation modal (mock) */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 w-[480px]">
            <h3 className="text-lg font-semibold">Confirm checkout (mock)</h3>
            <p className="text-sm text-gray-600 mt-2">
              This will simulate saving the order (mock). Price shown:{" "}
              <strong>₱{receipt.total.toFixed(2)}</strong>
            </p>

            <div className="mt-4 flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => setShowConfirm(false)}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 text-white"
                onClick={() => {
                  setShowConfirm(false);
                  // Mock action: in real app, prepare payload and call saveOrderApi(payload)
                  // const payload = { customer, products: orderProductCounts, baskets, totals: receipt };
                  // await saveOrderApi(payload)
                  alert(
                    "Order saved (mock). Payload would be sent to saveOrderApi() in production."
                  );
                  // reset order (mock)
                  setOrderProductCounts({});
                  setBaskets([newBasket(0)]);
                  setActiveBasketIndex(0);
                  setActivePane("customer");
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
