import React from "react";
import {
  Product,
  Customer,
  Basket,
  ReceiptBasketLine,
  ReceiptProductLine,
  LaundryService,
  Payment,
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
  originalIndex: index + 1,
  weightKg: 0,
  washCount: 0,
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
    deliveryFee: 50,
    courierRef: "",
    instructions: "",
  });

  const [showConfirm, setShowConfirm] = React.useState(false);
  const [payment, setPayment] = React.useState<Payment>({
    method: "cash",
  });

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

  // --- Calculate total estimated duration for a basket ---
  const calculateBasketDuration = (basket: Basket): number => {
    let totalMinutes = 0;

    // Wash duration
    if (basket.washCount > 0) {
      const washService = getServiceByType("wash", basket.washPremium);
      if (washService) {
        totalMinutes += washService.base_duration_minutes * basket.washCount;
      }
    }

    // Dry duration
    if (basket.dryCount > 0) {
      const dryService = getServiceByType("dry", basket.dryPremium);
      if (dryService) {
        totalMinutes += dryService.base_duration_minutes * basket.dryCount;
      }
    }

    // Spin duration
    if (basket.spinCount > 0) {
      const spinService = getServiceByType("spin", false);
      if (spinService) {
        totalMinutes += spinService.base_duration_minutes * basket.spinCount;
      }
    }

    // Iron duration
    if (basket.iron) {
      const ironService = getServiceByType("iron", false);
      if (ironService) {
        totalMinutes += ironService.base_duration_minutes;
      }
    }

    // Fold duration
    if (basket.fold) {
      const foldService = getServiceByType("fold", false);
      if (foldService) {
        totalMinutes += foldService.base_duration_minutes;
      }
    }

    return totalMinutes;
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
        premiumFlags: {
          wash: b.washPremium,
          dry: b.dryPremium,
        },
        notes: b.notes,
        total: subtotal, // NO service fee added
        estimatedDurationMinutes: calculateBasketDuration(b),
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

  const [isProcessing, setIsProcessing] = React.useState(false);

  const saveOrder = async () => {
    // Prevent double-click/double submission
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 0️⃣ Handle customer - create if new, or update if email was added
      let customerId = customer?.id || null;

      if (customer && !customer.id) {
        // New customer - create first
        const customerPayload = {
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone_number: customer.phone_number || null,
          email_address: customer.email_address || null,
          birthdate: customer.birthdate || null,
          gender: customer.gender || null,
          address: customer.address || null,
        };

        const res = await fetch("/api/customer/saveCustomer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customerPayload),
        });

        if (!res.ok) {
          console.error("Failed to create customer:", await res.text());
          alert("Failed to create customer. Please try again.");
          setIsProcessing(false);
          return null;
        }

        const data = await res.json();
        customerId = data.data?.[0]?.id;

        if (!customerId) {
          alert("Customer created but ID not returned. Please try again.");
          setIsProcessing(false);
          return null;
        }

        // Update local customer state with the new ID
        setCustomer({ ...customer, id: customerId });
      } else if (customer && customer.id && customer.email_address) {
        // Existing customer - check if email was just added (and send invitation)
        try {
          const res = await fetch("/api/customer/saveCustomer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: customer.id,
              first_name: customer.first_name,
              last_name: customer.last_name,
              phone_number: customer.phone_number,
              email_address: customer.email_address,
              birthdate: customer.birthdate,
              gender: customer.gender,
              address: customer.address,
            }),
          });

          if (!res.ok) {
            console.warn("Failed to update customer email:", await res.text());
            // Don't block order creation, just warn
          }
        } catch (err) {
          console.warn("Error updating customer email:", err);
          // Don't block order creation
        }
      }

      // 1️⃣ Prepare products array
      const productsPayload = Object.entries(orderProductCounts).map(
        ([productId, qty]) => {
          const product = products.find((p) => p.id === productId)!;
          return {
            product_id: productId,
            quantity: qty,
            unit_price: product.unit_price,
            subtotal: qty * product.unit_price,
          };
        }
      );

      // 2️⃣ Prepare baskets array with services
      const serviceTypes: Array<"wash" | "dry" | "spin" | "iron" | "fold"> = [
        "wash",
        "dry",
        "spin",
        "iron",
        "fold",
      ];

      const basketsPayload = baskets.map((b) => {
        const premiumMap: Record<string, boolean> = {
          wash: b.washPremium,
          dry: b.dryPremium,
          spin: false,
          iron: false,
          fold: false,
        };

        const services = serviceTypes
          .map((type) => {
            const countKey =
              type === "wash"
                ? "washCount"
                : type === "dry"
                  ? "dryCount"
                  : type === "spin"
                    ? "spinCount"
                    : type;

            const active =
              type === "iron" || type === "fold"
                ? Boolean(b[countKey])
                : (b[countKey] as number) > 0;

            if (!active) return null;

            const service = getServiceByType(type, premiumMap[type]);
            if (!service) return null;

            const qty =
              type === "iron" || type === "fold" ? 1 : (b[countKey] as number);

            const subtotal =
              (service.rate_per_kg ?? 0) * (b.weightKg ?? 0) * qty;

            return {
              service_id: service.id,
              rate: service.rate_per_kg,
              subtotal,
            };
          })
          .filter(Boolean);

        return {
          machine_id: b.machine_id || null,
          weight: b.weightKg,
          notes: b.notes || null,
          subtotal:
            computeReceipt.basketLines.find((bl) => bl.id === b.id)?.total ?? 0,
          services,
        };
      });

      // 3️⃣ Prepare customerId and total (including delivery fee if applicable)
      const totalWithDelivery = handling.deliver
        ? computeReceipt.total + handling.deliveryFee
        : computeReceipt.total;

      const payload = {
        customerId: customerId,
        total: totalWithDelivery,
        products: productsPayload,
        baskets: basketsPayload,
        payments: [],
      };

      // 4️⃣ Prepare payment
      const paymentPayload = {
        amount: totalWithDelivery,
        method: payment.method,
        reference: payment.referenceNumber || null,
      };

      // 5️⃣ Send to API
      const res = await fetch("/api/pos/newOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          payments: [paymentPayload],
        }),
      });

      if (!res.ok) {
        console.error("Save order failed:", await res.text());
        alert("Failed to save order. Check console.");
        setIsProcessing(false);
        return null;
      }

      const data = await res.json();
      console.log("Order saved:", data);
      alert(`Order saved. Total: ₱${computeReceipt.total.toFixed(2)}`);

      // RESET POS COMPLETELY
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
      setPayment({ method: "cash" });
      setShowConfirm(false);

      return data.orderId;
    } catch (err) {
      console.error("saveOrder():", err);
      alert("Something went wrong while saving the order.");
      return null;
    } finally {
      setIsProcessing(false);
    }
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
    payment,
    setPayment,
    computeReceipt,
    saveOrder,
    resetPOS,
    services,
    calculateBasketDuration,
    isProcessing,
  };
}
