"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClient } from "@/src/app/utils/supabase/client";
import { Basket, BasketServices, ServiceType, CustomerData, PaymentMethod, OrderItem, POSProduct, POSCustomer, OrderBreakdown, OrderHandling } from "./posTypes";
import { buildOrderBreakdown, calculateChange, isAmountSufficient } from "./posHelpers";
import { formatReceiptAsPlaintext, CompactReceipt } from "./receiptGenerator";

const createNewBasket = (basketNumber: number): Basket => ({
  basket_number: basketNumber,
  weight_kg: 0,
  services: { wash: "off", wash_cycles: 1, dry: "off", spin: false, iron_weight_kg: 0, fold: false, additional_dry_time_minutes: 0, plastic_bags: 0, heavy_fabrics: false },
  notes: "",
  subtotal: 0,
});

export function usePOSState() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
  const [serviceType, setServiceType] = useState<ServiceType>("self_service");
  const [baskets, setBaskets] = useState<Basket[]>([createNewBasket(1)]);
  const [activeBasketIndex, setActiveBasketIndex] = useState(0);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<POSCustomer[]>([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ first_name: "", last_name: "", phone_number: "", email_address: "" });
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState<number | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("13:00");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState(0);
  const [gcashReference, setGcashReference] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [receiptContent, setReceiptContent] = useState("");
  const [loyaltyDiscountTier, setLoyaltyDiscountTier] = useState<null | 'tier1' | 'tier2'>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      const supabase = createClient();
      const { data: servicesData } = await supabase.from("services").select("*").eq("is_active", true);
      if (servicesData) setServices(servicesData);
      const { data: productsData } = await supabase.from("products").select("id, item_name, unit_price, quantity, image_url, reorder_level").eq("is_active", true).order("item_name");
      if (productsData) {
        setProducts(productsData.map((p: any) => ({ id: p.id, item_name: p.item_name, unit_price: p.unit_price, quantity_in_stock: p.quantity, image_url: p.image_url, reorder_level: p.reorder_level })));
      }
      setLoadingProducts(false);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerSuggestions([]); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const query = customerSearch.toLowerCase();
      const { data } = await supabase.from("customers").select("id, first_name, last_name, phone_number, email_address, loyalty_points").or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_number.ilike.%${query}%`).limit(5);
      if (data) { setCustomerSuggestions(data.map((c: any) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, phone_number: c.phone_number, email_address: c.email_address, loyalty_points: c.loyalty_points || 0 }))); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const updateActiveBasketService = useCallback((serviceKey: keyof BasketServices, value: any) => {
    const updated = baskets.map((b, i) => i === activeBasketIndex ? { ...b, services: { ...b.services, [serviceKey]: value } } : b);
    setBaskets(updated);
  }, [activeBasketIndex, baskets]);

  const updateActiveBasketWeight = useCallback((weight: number) => {
    const updated = [...baskets];
    updated[activeBasketIndex].weight_kg = weight;
    if (weight > 8) {
      const overflow = weight - 8;
      updated[activeBasketIndex].weight_kg = 8;
      const newBasket = createNewBasket(Math.max(...updated.map((b) => b.basket_number)) + 1);
      newBasket.weight_kg = overflow;
      updated.push(newBasket);
      setActiveBasketIndex(updated.length - 1);
    }
    setBaskets(updated);
  }, [activeBasketIndex, baskets]);

  const updateActiveBasketNotes = useCallback((notes: string) => {
    const updated = [...baskets];
    updated[activeBasketIndex].notes = notes;
    setBaskets(updated);
  }, [activeBasketIndex, baskets]);

  const addNewBasket = useCallback(() => {
    const basketNumber = Math.max(...baskets.map((b) => b.basket_number), 0) + 1;
    setBaskets([...baskets, createNewBasket(basketNumber)]);
    setActiveBasketIndex(baskets.length);
  }, [baskets]);

  const deleteBasket = useCallback((index: number) => {
    if (baskets.length <= 1) return;
    const updated = baskets.filter((_, i) => i !== index);
    setBaskets(updated);
    if (activeBasketIndex >= updated.length) { setActiveBasketIndex(updated.length - 1); }
  }, [baskets, activeBasketIndex]);

  const addProductToOrder = useCallback((productId: string) => {
    setSelectedProducts((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  }, []);

  const removeProductFromOrder = useCallback((productId: string) => {
    setSelectedProducts((prev) => { const updated = { ...prev }; delete updated[productId]; return updated; });
  }, []);

  const setProductQuantity = useCallback((productId: string, quantity: number) => {
    setSelectedProducts((prev) => { if (quantity <= 0) { const updated = { ...prev }; delete updated[productId]; return updated; } return { ...prev, [productId]: quantity }; });
  }, []);

  const selectCustomer = useCallback((customer: POSCustomer) => {
    setCustomer({ id: customer.id, first_name: customer.first_name, last_name: customer.last_name, phone_number: customer.phone_number, email: customer.email_address, loyalty_points: customer.loyalty_points || 0 });
    setCustomerSearch("");
    setCustomerSuggestions([]);
    setShowCustomerForm(false);
  }, []);

  const createNewCustomer = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("customers").insert([newCustomerForm]).select().single();
    if (!error && data) {
      selectCustomer({ id: data.id, first_name: data.first_name, last_name: data.last_name, phone_number: data.phone_number, email_address: data.email_address, loyalty_points: 0 });
      setNewCustomerForm({ first_name: "", last_name: "", phone_number: "", email_address: "" });
    }
  }, [newCustomerForm, selectCustomer]);

  const clearCustomer = useCallback(() => {
    setCustomer(null);
    setCustomerSearch("");
    setCustomerSuggestions([]);
  }, []);

  const calculateOrderTotal = useCallback((): OrderBreakdown => {
    const items = Object.entries(selectedProducts).map(([productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      return { product_id: productId, product_name: product.item_name, unit_price: product.unit_price, quantity: qty };
    }).filter(Boolean) as OrderItem[];
    console.log("[POS] Calculating order total with baskets:", baskets.map(b => ({
      number: b.basket_number,
      weight: b.weight_kg,
      dry: b.services.dry,
      additional_dry_time_minutes: b.services.additional_dry_time_minutes,
    })));
    return buildOrderBreakdown(baskets, items, serviceType === "staff_service", deliveryType === "delivery", deliveryFeeOverride, services, products);
  }, [baskets, selectedProducts, serviceType, deliveryType, deliveryFeeOverride, services, products]);

  const isPaymentValid = useCallback((): boolean => {
    if (paymentMethod === "cash") {
      const breakdown = calculateOrderTotal();
      let discountPercent = 0;
      if (loyaltyDiscountTier === 'tier1') discountPercent = 0.05;
      if (loyaltyDiscountTier === 'tier2') discountPercent = 0.15;
      const totalAmount = customer && loyaltyDiscountTier ? breakdown.summary.total * (1 - discountPercent) : breakdown.summary.total;
      return isAmountSufficient(amountPaid, totalAmount);
    }
    if (paymentMethod === "gcash") return gcashReference.trim().length > 0;
    return false;
  }, [paymentMethod, amountPaid, gcashReference, calculateOrderTotal, loyaltyDiscountTier, customer]);

  const createOrder = useCallback(async () => {
    setIsProcessing(true);
    try {
      let breakdown = calculateOrderTotal();
      console.log("[POS CREATE] Breakdown baskets:", breakdown.baskets.map(b => ({
        number: b.basket_number,
        additional_dry_time_minutes: b.services.additional_dry_time_minutes,
        subtotal: b.subtotal,
      })));
      let discountPercent = 0;
      
      // Apply loyalty discount tier if selected
      if (loyaltyDiscountTier && customer) {
        if (loyaltyDiscountTier === 'tier1') discountPercent = 0.05;
        if (loyaltyDiscountTier === 'tier2') discountPercent = 0.15;
        const discountAmount = breakdown.summary.total * discountPercent;
        breakdown = {
          ...breakdown,
          summary: {
            ...breakdown.summary,
            loyalty_discount: discountAmount,
            total: breakdown.summary.total - discountAmount,
          },
        };
      }
      
      const handling: OrderHandling = {
        service_type: serviceType,
        handling_type: deliveryType,
        delivery_address: deliveryAddress || null,
        delivery_lng: deliveryLng,
        delivery_lat: deliveryLat,
        delivery_fee_override: deliveryFeeOverride,
        special_instructions: specialInstructions,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        gcash_reference: paymentMethod === "gcash" ? gcashReference : undefined,
        scheduled: scheduled,
        scheduled_date: scheduled ? scheduledDate : undefined,
        scheduled_time: scheduled ? scheduledTime : undefined,
      };

      console.log("[POS CREATE] Sending order with baskets:", breakdown.baskets.map(b => ({
        number: b.basket_number,
        additional_dry_time_minutes: b.services.additional_dry_time_minutes,
        subtotal: b.subtotal,
      })));

      // Build the payload
      const payload = {
        customer_id: customer?.id || null,
        customer_data: customer ? undefined : {
          first_name: newCustomerForm.first_name || "Customer",
          last_name: newCustomerForm.last_name || "Unknown",
          phone_number: newCustomerForm.phone_number || "",
          email: newCustomerForm.email_address,
        },
        breakdown: breakdown,
        handling: handling,
        loyalty: {
          discount_tier: loyaltyDiscountTier,
        },
      };

      console.log("[POS CREATE] Full payload baskets[0].services:", payload.breakdown.baskets[0]?.services);

      // Call the API endpoint instead of direct database insert
      const response = await fetch("/api/orders/pos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create order: ${response.statusText}`);
      }

      const responseData = await response.json();
      if (!responseData.success || !responseData.order_id) {
        throw new Error("Order created but no ID returned");
      }

      setLastOrderId(responseData.order_id);
      
      // Build receipt object from response data for formatting
      const receiptData: CompactReceipt = {
        orderId: responseData.order_id,
        customerName: 
          customer 
            ? `${customer.first_name} ${customer.last_name}` 
            : `${newCustomerForm.first_name} ${newCustomerForm.last_name}`.trim(),
        items: (breakdown.items || []).map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.unit_price * item.quantity,
        })),
        baskets: breakdown.baskets || [],
        total: breakdown.summary.total,
        timestamp: new Date().toISOString(),
        paymentMethod: paymentMethod.toUpperCase(),
        summary: breakdown.summary,
        change: paymentMethod === "cash" ? amountPaid - breakdown.summary.total : undefined,
      };

      // Format receipt for display
      const formattedReceipt = formatReceiptAsPlaintext(receiptData);
      setReceiptContent(formattedReceipt);
      setShowReceiptModal(true);
      resetOrder();
    } catch (error) {
      console.error("Order creation failed:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }, [calculateOrderTotal, serviceType, deliveryType, deliveryAddress, specialInstructions, paymentMethod, amountPaid, gcashReference, customer, loyaltyDiscountTier, scheduled, scheduledDate, scheduledTime])

  const resetOrder = useCallback(() => {
    setStep(0);
    setServiceType("self_service");
    setBaskets([createNewBasket(1)]);
    setActiveBasketIndex(0);
    setSelectedProducts({});
    setCustomer(null);
    setCustomerSearch("");
    setDeliveryType("pickup");
    setDeliveryAddress("");
    setDeliveryLng(null);
    setDeliveryLat(null);
    setDeliveryFeeOverride(null);
    setSpecialInstructions("");
    setPaymentMethod("cash");
    setAmountPaid(0);
    setGcashReference("");
    setLoyaltyDiscountTier(null);
  }, []);

  return {
    step, setStep, serviceType, setServiceType, baskets, setBaskets, activeBasketIndex, setActiveBasketIndex,
    updateActiveBasketService, updateActiveBasketWeight, updateActiveBasketNotes, addNewBasket, deleteBasket,
    products, loadingProducts, selectedProducts, addProductToOrder, removeProductFromOrder, setProductQuantity,
    customer, setCustomer, customerSearch, setCustomerSearch, customerSuggestions, selectCustomer, clearCustomer, showCustomerForm, setShowCustomerForm, newCustomerForm, setNewCustomerForm, createNewCustomer,
    deliveryType, setDeliveryType, deliveryAddress, setDeliveryAddress, deliveryLng, setDeliveryLng, deliveryLat, setDeliveryLat, deliveryFeeOverride, setDeliveryFeeOverride, specialInstructions, setSpecialInstructions,
    scheduled, setScheduled, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime,
    paymentMethod, setPaymentMethod, amountPaid, setAmountPaid, gcashReference, setGcashReference,
    loyaltyDiscountTier, setLoyaltyDiscountTier,
    calculateOrderTotal, isPaymentValid, createOrder, resetOrder, isProcessing,
    showReceiptModal, setShowReceiptModal, lastOrderId, receiptContent, services,
  };
}
