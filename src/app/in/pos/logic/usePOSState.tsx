import React from "react";
import {
  Product,
  Customer,
  Basket,
  ReceiptBasketLine,
  ReceiptProductLine,
  LaundryService,
  Payment,
  BreakdownJSON,
  HandlingJSON,
  OrderRow,
} from "./types";
import { HandlingState } from "./orderTypes";
import {
  buildHandlingJSON,
  buildBreakdownJSON,
  buildBreakdownItems,
  buildBreakdownBaskets,
  buildFeesArray,
  buildOrderSummary,
  addAuditLogEntry,
  updateServiceStatusInBreakdown,
} from "./orderHelpers";
import { generateCompactReceipt } from "./receiptGenerator";
import { generateReceiptFromDB } from "@/src/app/utils/receiptGenerator";
import { createClient } from "@/src/app/utils/supabase/client";

/**
 * usePOSState
 * - All POS state lives here
 * - Loads mock data, exposes handlers for UI
 * - Commented real API calls included where appropriate
 */

export const PRICING = {
  taxRate: 0.12, // 12%
  serviceFeePerBasket: 40, // Flat PHP40 service fee (not per basket)
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
    "customer" | "products" | "handling" | "basket"
  >("customer");

  // Navigation between panes
  const goToPane = (pane: "customer" | "products" | "handling" | "basket") => {
    setActivePane(pane);
  };

  // Handling (pickup/delivery)
  const [handling, setHandling] = React.useState<HandlingState>({
    pickup: true,
    deliver: false,
    pickupAddress: null,
    deliveryAddress: "",
    deliveryFee: 50,
    courierRef: "",
    instructions: "",
  });

  const [showConfirm, setShowConfirm] = React.useState(false);
  const [payment, setPayment] = React.useState<Payment>({
    method: "cash",
  });

  // --- Loyalty Points ---
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = React.useState(0);
  const [useLoyaltyDiscount, setUseLoyaltyDiscount] = React.useState(false);

  // --- Receipt Modal ---
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);
  const [receiptContent, setReceiptContent] = React.useState("");
  const [lastOrderId, setLastOrderId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadServices = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("services").select("*");

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
          `first_name.ilike.%${customerQuery}%,last_name.ilike.%${customerQuery}%,phone_number.ilike.%${customerQuery}%`,
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

  // --- Load loyalty points when customer is selected ---
  React.useEffect(() => {
    if (!customer?.id) {
      setCustomerLoyaltyPoints(0);
      setUseLoyaltyDiscount(false);
      return;
    }

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", customer.id)
        .single();

      if (error) {
        console.error("Failed to load loyalty points:", error);
        setCustomerLoyaltyPoints(0);
      } else {
        setCustomerLoyaltyPoints(data?.loyalty_points || 0);
      }
    })();
  }, [customer?.id]);

  // --- products add/remove ---
  // --- load products from DB ---
  React.useEffect(() => {
    const loadProducts = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .select("id, item_name, unit_price, unit_cost, image_url")
        .eq("is_active", true)
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
    // Build UI display lines (same as before for rendering)
    const productLines: ReceiptProductLine[] = Object.entries(
      orderProductCounts,
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

    const allBasketLines: ReceiptBasketLine[] = baskets.map((b) => {
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
        total: subtotal,
        estimatedDurationMinutes: calculateBasketDuration(b),
      };
    });

    // Filter out empty baskets (weightKg === 0) for actual order processing
    const basketLines: ReceiptBasketLine[] = allBasketLines.filter(
      (b) => b.weightKg > 0,
    );

    const basketSubtotal = basketLines.reduce((s, l) => s + l.total, 0);

    // Service fee: PHP40 only if there are baskets with weight and services
    const hasServiceBaskets = basketLines.some((b: any) => b.weightKg > 0);
    const serviceFee = hasServiceBaskets ? 40 : 0;

    // Handling fee (only if delivery)
    const handlingFee = handling.deliver ? handling.deliveryFee : 0;

    const subtotalBeforeTax =
      productSubtotal + basketSubtotal + serviceFee + handlingFee;

    // VAT included in subtotal
    const vatIncluded =
      subtotalBeforeTax * (PRICING.taxRate / (1 + PRICING.taxRate));

    // ========== LOYALTY DISCOUNT ==========
    // 10 points = 10%, 20 points = 15%
    let loyaltyDiscountAmount = 0;
    let loyaltyPointsUsed = 0;
    let loyaltyDiscountPercentage = 0;

    if (useLoyaltyDiscount) {
      if (customerLoyaltyPoints >= 20) {
        loyaltyPointsUsed = 20;
        loyaltyDiscountPercentage = 15;
        loyaltyDiscountAmount = subtotalBeforeTax * 0.15;
      } else if (customerLoyaltyPoints >= 10) {
        loyaltyPointsUsed = 10;
        loyaltyDiscountPercentage = 10;
        loyaltyDiscountAmount = subtotalBeforeTax * 0.1;
      }
    }

    const totalAfterDiscount = subtotalBeforeTax - loyaltyDiscountAmount;
    const total = totalAfterDiscount; // final total after loyalty discount

    // NEW: Build complete breakdown JSONB for database storage
    let breakdown: BreakdownJSON | null = null;
    try {
      breakdown = buildBreakdownJSON(
        orderProductCounts,
        baskets.filter((b) => b.weightKg > 0), // Only include baskets with weight
        products,
        services,
        handling,
        payment.method || "cash",
        payment.amountPaid || 0,
        PRICING.serviceFeePerBasket,
        PRICING.taxRate,
      );
    } catch (err) {
      console.error("Error building breakdown:", err);
    }

    return {
      // UI display lines
      productLines,
      basketLines,
      productSubtotal,
      basketSubtotal,
      serviceFee,
      handlingFee,
      taxIncluded: vatIncluded,
      total,

      // Loyalty discount info
      loyaltyDiscountAmount,
      loyaltyPointsUsed,
      loyaltyDiscountPercentage,

      // NEW: Database storage objects
      breakdown,
      handling: buildHandlingJSON(handling, handling.instructions),
    };
  }, [
    orderProductCounts,
    baskets,
    products,
    handling,
    payment.method,
    payment.amountPaid,
    services,
    useLoyaltyDiscount,
    customerLoyaltyPoints,
  ]);

  const [isProcessing, setIsProcessing] = React.useState(false);

  const validateBaskets = () => {
    const warnings: string[] = [];
    const emptyBasketIndices: number[] = [];

    baskets.forEach((basket, index) => {
      // Check if basket is empty (0kg weight)
      if (basket.weightKg === 0) {
        emptyBasketIndices.push(index);
        return;
      }

      // Check if basket has weight but no services
      const hasService =
        basket.washCount > 0 ||
        basket.dryCount > 0 ||
        basket.spinCount > 0 ||
        basket.iron ||
        basket.fold;

      if (!hasService) {
        warnings.push(
          `Basket ${basket.originalIndex} has weight (${basket.weightKg}kg) but no services selected.`,
        );
      }
    });

    return { warnings, emptyBasketIndices };
  };

  const saveOrder = async () => {
    // Prevent double-click/double submission
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // VALIDATE
      if (!customer?.id) {
        alert("Customer must be selected or created first");
        setIsProcessing(false);
        return null;
      }

      const { warnings } = validateBaskets();
      if (warnings.length > 0) {
        alert(`Please fix the following issues:\n\n${warnings.join("\n")}`);
        setIsProcessing(false);
        return null;
      }

      if (!computeReceipt.breakdown) {
        alert("Error building order breakdown. Please try again.");
        setIsProcessing(false);
        return null;
      }

      // Get authenticated cashier (from context/auth)
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!user || userError) {
        alert(
          "Unable to get authenticated staff. Please refresh and try again.",
        );
        setIsProcessing(false);
        return null;
      }

      // Get cashier ID (staff record with this auth_id)
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (staffError || !staffData) {
        alert("Unable to find your staff record. Please contact support.");
        setIsProcessing(false);
        return null;
      }

      const cashierId = staffData.id;

      // UPDATE breakdown with cashier info in audit log
      const breakdownWithAudit = {
        ...computeReceipt.breakdown,
        audit_log: [
          {
            ...computeReceipt.breakdown.audit_log[0],
            changed_by: cashierId,
          },
          ...computeReceipt.breakdown.audit_log.slice(1),
        ],
      };

      // UPDATE payment status to successful
      const breakdownWithPayment = {
        ...breakdownWithAudit,
        payment: {
          ...breakdownWithAudit.payment,
          payment_status: "successful" as const,
          completed_at: new Date().toISOString(),
        },
      };

      // PREPARE order payload
      const orderPayload = {
        source: "store" as const,
        customer_id: customer.id,
        cashier_id: cashierId,
        status:
          computeReceipt.basketLines.length > 0 ||
          computeReceipt.handling.pickup.status === "pending" ||
          computeReceipt.handling.delivery.status === "pending"
            ? "processing"
            : "completed",
        total_amount: computeReceipt.total,
        order_note: null,
        breakdown: breakdownWithPayment,
        handling: computeReceipt.handling,
        // Loyalty discount info (if applicable)
        loyaltyPointsUsed: computeReceipt.loyaltyPointsUsed,
        loyaltyDiscountAmount: computeReceipt.loyaltyDiscountAmount,
        loyaltyDiscountPercentage: computeReceipt.loyaltyDiscountPercentage,
      };

      // CALL transactional API endpoint to update customer + create order
      const res = await fetch("/api/orders/transactional-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: customer.id,
            phone_number: customer.phone_number,
            email_address: customer.email_address,
          },
          orderPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Transactional order creation failed:", data);
        if (data.partialSuccess) {
          alert(
            "Customer details were saved, but the order could not be created. Please try again.",
          );
        } else {
          alert(data.error || "Failed to save order. Please try again.");
        }
        setIsProcessing(false);
        return null;
      }

      if (!data.success || !data.orderId) {
        alert("Order created but with unexpected response format.");
        setIsProcessing(false);
        return null;
      }

      const orderId = data.orderId;
      console.log("✓ Order created:", orderId);

      // GENERATE RECEIPT FROM DATABASE
      try {
        console.log(
          "🔄 [POS] Starting receipt generation for orderId:",
          orderId,
        );
        const receiptData = await generateReceiptFromDB(orderId);

        console.log("✅ [POS] Receipt data received:", {
          plaintext: receiptData.plaintext.substring(0, 100) + "...",
          contentLength: receiptData.plaintext.length,
          orderId: receiptData.orderId,
          timestamp: receiptData.timestamp,
        });

        setReceiptContent(receiptData.plaintext);
        setLastOrderId(orderId);
        setShowReceiptModal(true);

        console.log("✅ [POS] Receipt modal state updated, showing receipt");
        console.log("✓ Receipt generated successfully");
      } catch (receiptErr) {
        console.error("❌ [POS] Receipt generation error:", receiptErr);
        console.error("❌ [POS] Error details:", {
          message:
            receiptErr instanceof Error
              ? receiptErr.message
              : String(receiptErr),
          stack: receiptErr instanceof Error ? receiptErr.stack : undefined,
        });
        // Don't block order completion if receipt generation fails
        // Fallback: show success message without receipt modal
        alert(
          `Order created successfully (ID: ${orderId}). Receipt generation failed, but a copy will be sent via email.`,
        );
      }

      // RESET POS
      resetPOS();

      return orderId;
    } catch (err) {
      console.error("saveOrder error:", err);
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
      pickupAddress: null,
      deliveryAddress: "",
      deliveryFee: 0,
      courierRef: "",
      instructions: "",
    });
    setPayment({ method: "cash" });
    setActivePane("customer");
    setCustomerLoyaltyPoints(0);
    setUseLoyaltyDiscount(false);
  };

  return {
    products,
    customer,
    setCustomer,
    customerQuery,
    setCustomerQuery,
    customerSuggestions,
    setCustomerSuggestions,
    goToPane,
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
    // Loyalty points
    customerLoyaltyPoints,
    setCustomerLoyaltyPoints,
    useLoyaltyDiscount,
    setUseLoyaltyDiscount,
    // Receipt modal
    showReceiptModal,
    setShowReceiptModal,
    receiptContent,
    lastOrderId,
    // NEW: Expose JSONB objects for database storage
    orderBreakdown: computeReceipt.breakdown,
    orderHandling: computeReceipt.handling,
  };
}
