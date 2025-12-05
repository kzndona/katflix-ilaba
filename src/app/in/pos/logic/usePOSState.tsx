import React from "react";
import {
  Product,
  Customer,
  Basket,
  ReceiptBasketLine,
  ReceiptProductLine,
  LaundryService,
} from "./types";
import { createClient } from "@/src/app/utils/supabase/client";

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
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(true);

  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [customerSuggestions, setCustomerSuggestions] = React.useState<
    Customer[]
  >([]);

  // --- Services ---
  const [services, setServices] = React.useState<LaundryService[]>([]);

  // --- Baskets ---
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

  React.useEffect(() => {
    const loadServices = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);

      if (error) {
        console.error("Service load error:", error);
        setServices([]);
      } else {
        setServices(data || []);
      }
    };

    loadServices();
  }, []);

  // --- Customer search ---
  React.useEffect(() => {
    if (!customerQuery) {
      setCustomerSuggestions([]);
      return;
    }

    // --- Real API call ---
    (async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(
          `first_name.ilike.%${customerQuery}%,last_name.ilike.%${customerQuery}%,phone_number.ilike.%${customerQuery}%`
        )
        .limit(10);

      if (error) {
        console.error("Customer search error:", error);
        setCustomerSuggestions([]);
      } else {
        setCustomerSuggestions(data || []);
      }
    })();
  }, [customerQuery]);

  // --- products add/remove ---
  // --- load products from DB ---
  React.useEffect(() => {
    const loadProducts = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .select("id, item_name, unit_price")
        .order("item_name", { ascending: true });

      if (error) {
        console.error("Failed to load products:", error);
        setProducts([]);
      } else {
        setProducts(data || []);
      }

      setLoadingProducts(false);
    };

    loadProducts();
  }, []);

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

  const getServiceByType = (type: string, premium: boolean) => {
    // premium toggle means: fetch service where name contains "Premium"
    const matches = services.filter((s) => s.service_type === type);

    if (matches.length === 0) return null;

    if (premium) {
      return (
        matches.find((s) => s.name.toLowerCase().includes("premium")) ||
        matches[0]
      );
    }

    // basic = first non-premium service
    return (
      matches.find((s) => !s.name.toLowerCase().includes("premium")) ||
      matches[0]
    );
  };

  // --- receipt/calculation ---
  const computeReceipt = React.useMemo(() => {
    const productLines: ReceiptProductLine[] = Object.entries(
      orderProductCounts
    ).map(([pid, qty]) => {
      const p = products.find((x) => x.id === pid)!;
      const lineTotal = p.unit_price * qty;
      return {
        id: pid,
        name: p.item_name,
        qty,
        price: p.unit_price,
        lineTotal,
      };
    });

    const productSubtotal = productLines.reduce((s, l) => s + l.lineTotal, 0);

    const basketLines: ReceiptBasketLine[] = baskets.map((b) => {
      const weight = b.weightKg;

      const washService = getServiceByType("wash", b.washPremium);
      const washPrice =
        b.washCount > 0 && washService
          ? washService.rate_per_kg * weight * b.washCount
          : 0;

      const dryService = getServiceByType("dry", b.dryPremium);
      const dryPrice =
        b.dryCount > 0 && dryService
          ? dryService.rate_per_kg * weight * b.dryCount
          : 0;

      const spinService = getServiceByType("spin", false);
      const spinPrice =
        b.spinCount > 0 && spinService
          ? spinService.rate_per_kg * weight * b.spinCount
          : 0;

      const ironService = getServiceByType("iron", false);
      const ironPrice =
        b.iron && ironService ? ironService.rate_per_kg * weight : 0;

      const foldService = getServiceByType("fold", false);
      const foldPrice =
        b.fold && foldService ? foldService.rate_per_kg * weight : 0;

      const subtotal = washPrice + dryPrice + spinPrice + ironPrice + foldPrice;

      return {
        id: b.id,
        name: b.name,
        weightKg: b.weightKg,
        breakdown: {
          wash: washPrice,
          dry: dryPrice,
          spin: spinPrice,
          iron: ironPrice,
          fold: foldPrice,
        },
        total: subtotal, // NO service fee added
      };
    });

    const basketSubtotal = basketLines.reduce((s, l) => s + l.total, 0);

    // Handling fee (only if delivery)
    const handlingFee = handling.deliver ? handling.deliveryFee : 0;

    const subtotalBeforeTax = productSubtotal + basketSubtotal + handlingFee;

    // VAT included in subtotal
    const vatIncluded =
      subtotalBeforeTax * (PRICING.taxRate / (1 + PRICING.taxRate));

    const total = subtotalBeforeTax; // final total includes VAT already

    return {
      productLines,
      basketLines,
      productSubtotal,
      basketSubtotal,
      handlingFee,
      taxIncluded: vatIncluded,
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

  const resetPOS = () => {
    setOrderProductCounts({});
    setBaskets([newBasket(0)]);
    setActiveBasketIndex(0);
    setCustomer(null);
    setCustomerQuery("");
    setCustomerSuggestions([]);
    setHandling({
      pickup: true,
      deliver: false,
      pickupAddress: "",
      deliveryAddress: "",
      deliveryFee: 0,
      courierRef: "",
      instructions: "",
    });
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
    resetPOS,
  };
}
