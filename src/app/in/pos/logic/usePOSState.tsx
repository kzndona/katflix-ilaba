import React from "react";
import {
  Product,
  Customer,
  Basket,
  ReceiptBasketLine,
  ReceiptProductLine,
} from "./types";

/**
 * usePOSState
 * - All POS state lives here
 * - Loads mock data, exposes handlers for UI
 * - Commented real API calls included where appropriate
 */

export const PRICING = {
  taxRate: 0.12, // 12%
  serviceFeePerBasket: 10,
};

const newBasket = (index: number): Basket => ({
  id: `b${Date.now()}${index}`,
  name: `Basket ${index + 1}`,
  weightKg: 3.0,
  washCount: 1,
  dryCount: 0,
  spinCount: 0,
  washPremium: false,
  dryPremium: false,
  iron: false,
  fold: false,
  notes: "",
});

export function usePOSState() {
  // --- Mock Data ---
  const [products] = React.useState<Product[]>([
    { id: "p1", name: "HMA Detergent", price: 35 },
    { id: "p2", name: "Downy Blue", price: 7 },
    { id: "p3", name: "Stain Remover", price: 55 },
    { id: "p4", name: "Fabric Softener", price: 10 },
  ]);

  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [customerSuggestions, setCustomerSuggestions] = React.useState<
    Customer[]
  >([]);

  const [baskets, setBaskets] = React.useState<Basket[]>([newBasket(0)]);
  const [activeBasketIndex, setActiveBasketIndex] = React.useState(0);

  const [orderProductCounts, setOrderProductCounts] = React.useState<
    Record<string, number>
  >({});
  const [activePane, setActivePane] = React.useState<
    "customer" | "handling" | "products" | "basket"
  >("customer");

  // Handling (pickup/delivery)
  const [handling, setHandling] = React.useState({
    pickup: true,
    deliver: false,
    pickupAddress: "",
    deliveryAddress: "",
    deliveryFee: 0,
    courierRef: "",
    instructions: "",
  });

  const [showConfirm, setShowConfirm] = React.useState(false);

  // --- Customer search (mock) ---
  React.useEffect(() => {
    if (!customerQuery) {
      setCustomerSuggestions([]);
      return;
    }
    // Mock search: returns customers whose first/last contains query
    const seed: Customer[] = [
      {
        id: "c1",
        first_name: "Ana",
        last_name: "Santos",
        phone_number: "09171234567",
      },
      {
        id: "c2",
        first_name: "Miguel",
        last_name: "Reyes",
        phone_number: "09179876543",
      },
    ];
    const results = seed.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`
          .toLowerCase()
          .includes(customerQuery.toLowerCase()) ||
        (c.phone_number ?? "").includes(customerQuery)
    );
    setCustomerSuggestions(results);

    // --- Real API example (commented) ---
    // (async () => {
    //   const { data, error } = await supabase
    //     .from("customers")
    //     .select("*")
    //     .ilike("first_name", `%${customerQuery}%`)
    //   if (error) console.error(error)
    //   else setCustomerSuggestions(data)
    // })();
  }, [customerQuery]);

  // --- products add/remove ---
  const addProduct = (productId: string) => {
    setOrderProductCounts((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const removeProduct = (productId: string) => {
    setOrderProductCounts((prev) => {
      const copy = { ...prev };
      const current = copy[productId] || 0;
      if (current <= 1) delete copy[productId];
      else copy[productId] = current - 1;
      return copy;
    });
  };

  // --- baskets management ---
  const addBasket = () => {
    setBaskets((prev) => {
      const copy = prev.slice();
      copy.push(newBasket(copy.length));
      return copy;
    });
  };

  const deleteBasket = (index: number) => {
    setBaskets((prev) => {
      if (prev.length <= 1) return prev;
      const copy = prev.slice();
      copy.splice(index, 1);
      const newIndex = Math.max(0, activeBasketIndex - 1);
      setActiveBasketIndex(newIndex);
      return copy;
    });
  };

  const updateActiveBasket = (patch: Partial<Basket>) => {
    setBaskets((prev) => {
      const copy = prev.map((b) => ({ ...b }));
      copy[activeBasketIndex] = { ...copy[activeBasketIndex], ...patch };
      return copy;
    });
  };

  // --- receipt/calculation ---
  const computeReceipt = React.useMemo(() => {
    const productLines: ReceiptProductLine[] = Object.entries(
      orderProductCounts
    ).map(([pid, qty]) => {
      const p = products.find((x) => x.id === pid)!;
      const lineTotal = p.price * qty;
      return { id: pid, name: p.name, qty, price: p.price, lineTotal };
    });

    const productSubtotal = productLines.reduce((s, l) => s + l.lineTotal, 0);

    // Baskets cost mock calculation: base rates depend on weight & services
    const basketLines: ReceiptBasketLine[] = baskets.map((b) => {
      const wash = b.washCount * 50 + (b.washPremium ? 25 : 0); // mock
      const dry = b.dryCount * 30 + (b.dryPremium ? 10 : 0);
      const spin = b.spinCount * 10;
      const subtotal =
        wash + dry + spin + (b.iron ? 20 : 0) + (b.fold ? 10 : 0);
      const total = subtotal + PRICING.serviceFeePerBasket;
      return {
        id: b.id,
        name: b.name,
        weightKg: b.weightKg,
        breakdown: { wash, dry, spin },
        total,
      };
    });

    const basketSubtotal = basketLines.reduce((s, l) => s + l.total, 0);

    const handlingFee = handling.deliver ? handling.deliveryFee : 0;
    const fee = PRICING.serviceFeePerBasket * baskets.length + handlingFee;
    const taxBase = productSubtotal + basketSubtotal + fee;
    const tax = taxBase * PRICING.taxRate;
    const total = taxBase + tax;

    return {
      productLines,
      basketLines,
      productSubtotal,
      basketSubtotal,
      fee,
      handlingFee,
      tax,
      total,
    };
  }, [orderProductCounts, baskets, products, handling]);

  // --- mock submit order ---
  const saveOrder = async () => {
    const payload = {
      customer,
      products: orderProductCounts,
      baskets,
      handling,
      totals: computeReceipt,
    };

    // Mock action:
    console.log("Saving order (mock)", payload);
    alert(`Order saved (mock). Total: ₱${computeReceipt.total.toFixed(2)}`);

    // --- Real API example (commented) ---
    // try {
    //   const { data, error } = await supabase.from("orders").insert([payload])
    //   if (error) throw error
    //   console.log("saved", data)
    // } catch (err) {
    //   console.error(err)
    // }

    // reset
    setOrderProductCounts({});
    setBaskets([newBasket(0)]);
    setActiveBasketIndex(0);
    setActivePane("customer");
  };

  return {
    products,
    customer,
    setCustomer,
    customerQuery,
    setCustomerQuery,
    customerSuggestions,
    setCustomerSuggestions,
    baskets,
    setBaskets,
    activeBasketIndex,
    setActiveBasketIndex,
    addBasket,
    deleteBasket,
    updateActiveBasket,
    orderProductCounts,
    setOrderProductCounts,
    addProduct,
    removeProduct,
    activePane,
    setActivePane,
    handling,
    setHandling,
    showConfirm,
    setShowConfirm,
    computeReceipt,
    saveOrder,
  };
}
