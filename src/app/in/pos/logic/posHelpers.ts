/**
 * posHelpers.ts
 * Calculation functions for POS orders
 * 
 * Key rules:
 * - VAT: 12% INCLUSIVE (not added on top)
 * - Staff service fee: 40 PHP per ORDER if selected (not per basket)
 * - Delivery fee: 50 PHP minimum, can override but not below 50
 * - Iron: minimum 2kg (skip if < 2kg)
 * - Basket weight: max 8kg (auto-create new basket if exceeded)
 */

import { Basket, BasketServices, Service, OrderBreakdown, Fee, POSProduct } from "./posTypes";

// ============================================================================
// CONSTANTS
// ============================================================================

const PRICING = {
  TAX_RATE: 0.12,                    // 12% VAT
  STAFF_SERVICE_FEE: 40,             // Per ORDER (flat)
  DELIVERY_FEE_DEFAULT: 50,
  DELIVERY_FEE_MIN: 50,
  BASKET_WEIGHT_MAX: 8,
  IRON_WEIGHT_MIN: 2,
  IRON_WEIGHT_MAX: 8,
  ADDITIONAL_DRY_TIME_PRICE_PER_LEVEL: 15,
  FOLD_PRICE: 0,                     // Assume included or free for now
};

// ============================================================================
// SERVICE PRICING HELPERS
// ============================================================================

/**
 * Get service price from database services
 * For wash/dry, check tier to get basic or premium price
 */
export function getServicePrice(
  services: Service[],
  serviceType: "wash" | "dry" | "spin" | "iron" | "fold",
  tier?: "basic" | "premium"
): number {
  const matching = services.filter((s) => s.service_type === serviceType);

  if (matching.length === 0) return 0;

  // For wash/dry, filter by tier
  if ((serviceType === "wash" || serviceType === "dry") && tier) {
    const tiered = matching.find((s) => s.tier === tier);
    if (tiered) return tiered.base_price;
  }

  // Default: return first matching service price
  return matching[0].base_price;
}

/**
 * Get service duration from database services
 */
export function getServiceDuration(
  services: Service[],
  serviceType: "wash" | "dry" | "spin" | "iron" | "fold",
  tier?: "basic" | "premium"
): number {
  const matching = services.filter((s) => s.service_type === serviceType);

  if (matching.length === 0) return 0;

  // For wash/dry, filter by tier
  if ((serviceType === "wash" || serviceType === "dry") && tier) {
    const tiered = matching.find((s) => s.tier === tier);
    if (tiered) return tiered.base_duration_minutes;
  }

  // Default: return first matching service duration
  return matching[0].base_duration_minutes;
}

// ============================================================================
// BASKET CALCULATIONS
// ============================================================================

/**
 * Calculate subtotal for a single basket
 * Based on services selected
 */
export function calculateBasketSubtotal(
  basket: Basket,
  services: Service[],
  products: POSProduct[]
): number {
  let total = 0;
  console.log(`[calculateBasketSubtotal] Starting calculation for basket ${basket.basket_number}`);

  // Wash
  if (basket.services.wash !== "off") {
    const price = getServicePrice(
      services,
      "wash",
      basket.services.wash as "basic" | "premium"
    );
    console.log(`[calculateBasketSubtotal] Wash (${basket.services.wash}): ₱${price}`);
    total += price;
  }

  // Dry
  if (basket.services.dry !== "off") {
    const price = getServicePrice(
      services,
      "dry",
      basket.services.dry as "basic" | "premium"
    );
    console.log(`[calculateBasketSubtotal] Dry (${basket.services.dry}): ₱${price}`);
    total += price;
  }

  // Spin
  if (basket.services.spin) {
    const price = getServicePrice(services, "spin");
    console.log(`[calculateBasketSubtotal] Spin: ₱${price}`);
    total += price;
  }

  // Iron (minimum 2kg, only if weight >= 2kg)
  if (
    basket.services.iron_weight_kg >=
    PRICING.IRON_WEIGHT_MIN
  ) {
    const ironPrice = getServicePrice(services, "iron");
    console.log(`[calculateBasketSubtotal] Iron (${basket.services.iron_weight_kg}kg @ ₱${ironPrice}/kg): ₱${basket.services.iron_weight_kg * ironPrice}`);
    total += basket.services.iron_weight_kg * ironPrice;
  }

  // Fold
  if (basket.services.fold) {
    console.log(`[calculateBasketSubtotal] Fold: ₱${PRICING.FOLD_PRICE}`);
    total += PRICING.FOLD_PRICE;
  }

  // Additional dry time
  const dryTimeLevels = basket.services.additional_dry_time_minutes / 8; // 0, 1, 2, or 3
  const additionalDryTimeCost = dryTimeLevels * PRICING.ADDITIONAL_DRY_TIME_PRICE_PER_LEVEL;
  console.log(`[calculateBasketSubtotal] Additional Dry Time: ${basket.services.additional_dry_time_minutes}min ÷ 8 = ${dryTimeLevels} levels × ₱${PRICING.ADDITIONAL_DRY_TIME_PRICE_PER_LEVEL} = ₱${additionalDryTimeCost}`);
  total += additionalDryTimeCost;

  // Plastic bags - included in services subtotal
  if ((basket.services.plastic_bags || 0) > 0) {
    const plasticBagProduct = products.find(
      (p: any) => p.item_name?.toLowerCase().includes("plastic") || p.item_name?.toLowerCase().includes("bag")
    );
    const plasticBagPrice = plasticBagProduct?.unit_price || 0.50;
    console.log(`[calculateBasketSubtotal] Plastic bags (${basket.services.plastic_bags}): ₱${(basket.services.plastic_bags || 0) * plasticBagPrice}`);
    total += (basket.services.plastic_bags || 0) * plasticBagPrice;
  }

  console.log(`[calculateBasketSubtotal] FINAL BASKET ${basket.basket_number} TOTAL: ₱${total}`);
  return total;
}

/**
 * Calculate estimated duration for a basket
 */
export function calculateBasketDuration(
  basket: Basket,
  services: Service[]
): number {
  let totalMinutes = 0;

  // Wash
  if (basket.services.wash !== "off") {
    const duration = getServiceDuration(
      services,
      "wash",
      basket.services.wash as "basic" | "premium"
    );
    totalMinutes += duration;
  }

  // Dry
  if (basket.services.dry !== "off") {
    const duration = getServiceDuration(
      services,
      "dry",
      basket.services.dry as "basic" | "premium"
    );
    totalMinutes += duration;
  }

  // Spin
  if (basket.services.spin) {
    const duration = getServiceDuration(services, "spin");
    totalMinutes += duration;
  }

  // Iron
  if (basket.services.iron_weight_kg >= PRICING.IRON_WEIGHT_MIN) {
    const duration = getServiceDuration(services, "iron");
    totalMinutes += duration;
  }

  // Fold
  if (basket.services.fold) {
    const duration = getServiceDuration(services, "fold");
    totalMinutes += duration;
  }

  // Additional dry time is already in minutes
  totalMinutes += basket.services.additional_dry_time_minutes;

  return totalMinutes;
}

// ============================================================================
// DELIVERY FEE VALIDATION
// ============================================================================

/**
 * Validate and normalize delivery fee
 * Must be >= 50, default is 50
 */
export function validateDeliveryFee(fee: number | null | undefined): number {
  if (!fee) return PRICING.DELIVERY_FEE_DEFAULT;
  if (fee < PRICING.DELIVERY_FEE_MIN) return PRICING.DELIVERY_FEE_MIN;
  return fee;
}

// ============================================================================
// ORDER CALCULATIONS
// ============================================================================

/**
 * Calculate VAT amount (12% inclusive)
 * VAT is already included in prices, not added on top
 * To extract VAT from a subtotal:
 * vat = subtotal * (taxRate / (1 + taxRate))
 * = subtotal * (0.12 / 1.12)
 */
export function calculateVATAmount(subtotal: number): number {
  return subtotal * (PRICING.TAX_RATE / (1 + PRICING.TAX_RATE));
}

/**
 * Calculate staff service fee
 * 40 PHP flat if service_type is staff_service
 * Otherwise 0
 */
export function calculateStaffServiceFee(isStaffService: boolean): number {
  return isStaffService ? PRICING.STAFF_SERVICE_FEE : 0;
}

/**
 * Build complete order breakdown
 */
export function buildOrderBreakdown(
  baskets: Basket[],
  items: Array<{ product_id: string; product_name: string; unit_price: number; quantity: number }>,
  isStaffService: boolean,
  isDelivery: boolean,
  deliveryFeeOverride: number | null,
  services: Service[],
  products: POSProduct[]
): OrderBreakdown {
  // Calculate product subtotal
  const itemsArray = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.unit_price * item.quantity,
  }));
  const subtotalProducts = itemsArray.reduce(
    (sum, item) => sum + item.total_price,
    0
  );

  // Calculate basket subtotals and enrich with pricing information
  const basketsWithSubtotals = baskets.map((basket) => {
    // Enrich services with pricing objects for receipt display
    const enrichedServices = { ...basket.services };
    
    // Add wash pricing
    if (basket.services.wash && basket.services.wash !== "off") {
      const washTier = basket.services.wash as "basic" | "premium";
      const washService = services.find(s => s.service_type === "wash" && s.tier === washTier);
      if (washService) {
        enrichedServices.wash_pricing = {
          name: washService.name,
          tier: washService.tier,
          base_price: washService.base_price,
          service_type: "wash"
        };
      }
    }
    
    // Add dry pricing
    if (basket.services.dry && basket.services.dry !== "off") {
      const dryTier = basket.services.dry as "basic" | "premium";
      const dryService = services.find(s => s.service_type === "dry" && s.tier === dryTier);
      if (dryService) {
        enrichedServices.dry_pricing = {
          name: dryService.name,
          tier: dryService.tier,
          base_price: dryService.base_price,
          service_type: "dry"
        };
      }
    }
    
    // Add spin pricing
    if (basket.services.spin) {
      const spinService = services.find(s => s.service_type === "spin");
      if (spinService) {
        enrichedServices.spin_pricing = {
          name: spinService.name,
          tier: spinService.tier,
          base_price: spinService.base_price,
          service_type: "spin"
        };
      }
    }
    
    // Add iron pricing
    if (basket.services.iron_weight_kg >= PRICING.IRON_WEIGHT_MIN) {
      const ironService = services.find(s => s.service_type === "iron");
      if (ironService) {
        enrichedServices.iron_pricing = {
          name: ironService.name,
          tier: ironService.tier,
          base_price: ironService.base_price,
          service_type: "iron"
        };
      }
    }
    
    // Add additional dry time pricing
    if (basket.services.additional_dry_time_minutes > 0) {
      enrichedServices.additional_dry_time_pricing = {
        name: "Additional Dry Time",
        tier: null,
        base_price: PRICING.ADDITIONAL_DRY_TIME_PRICE_PER_LEVEL,
        service_type: "additional_dry_time"
      };
    }
    
    // Add staff service pricing
    if (isStaffService) {
      enrichedServices.staff_service_pricing = {
        name: "Staff Service",
        tier: null,
        base_price: PRICING.STAFF_SERVICE_FEE,
        service_type: "staff_service"
      };
    }
    
    return {
      ...basket,
      services: enrichedServices,
      subtotal: calculateBasketSubtotal(basket, services, products),
    };
  });
  const subtotalServices = basketsWithSubtotals.reduce(
    (sum, basket) => sum + basket.subtotal,
    0
  );

  // Calculate fees
  const staffServiceFee = calculateStaffServiceFee(isStaffService);
  const deliveryFee = isDelivery
    ? validateDeliveryFee(deliveryFeeOverride)
    : 0;

  // Subtotal before VAT (includes all items, services, and fees)
  const subtotalBeforeVAT =
    subtotalProducts + subtotalServices + staffServiceFee + deliveryFee;

  // Calculate VAT (12% inclusive)
  const vatAmount = calculateVATAmount(subtotalBeforeVAT);

  // Final total
  const total = subtotalBeforeVAT;

  // Build fees array
  const feesArray: Fee[] = [];
  if (staffServiceFee > 0) {
    feesArray.push({
      type: "staff_service_fee",
      amount: staffServiceFee,
      description: "Staff service fee",
    });
  }
  if (deliveryFee > 0) {
    feesArray.push({
      type: "delivery_fee",
      amount: deliveryFee,
      description: "Delivery fee",
    });
  }
  feesArray.push({
    type: "vat",
    amount: vatAmount,
    description: "VAT (12% inclusive)",
  });

  return {
    items: itemsArray,
    baskets: basketsWithSubtotals,
    fees: feesArray,
    summary: {
      subtotal_products: subtotalProducts,
      subtotal_services: subtotalServices,
      staff_service_fee: staffServiceFee,
      delivery_fee: deliveryFee,
      subtotal_before_vat: subtotalBeforeVAT,
      vat_amount: vatAmount,
      loyalty_discount: 0, // TODO: implement loyalty
      total,
    },
  };
}

// ============================================================================
// AUTO-BASKET CREATION
// ============================================================================

/**
 * Check if adding weight to a basket exceeds limit
 * If so, return new basket array with overflow moved to new basket
 */
export function autoCreateBasketIfNeeded(
  baskets: Basket[],
  basketIndex: number,
  newWeight: number
): Basket[] {
  const basket = baskets[basketIndex];
  const newBasketArray = baskets.map((b) => ({ ...b }));

  // If new weight exceeds max, create new basket with overflow
  if (newWeight > PRICING.BASKET_WEIGHT_MAX) {
    const excess = newWeight - PRICING.BASKET_WEIGHT_MAX;

    // Limit current basket to max
    newBasketArray[basketIndex].weight_kg = PRICING.BASKET_WEIGHT_MAX;

    // Create new basket with excess
    const newBasket: Basket = {
      basket_number: Math.max(...newBasketArray.map((b) => b.basket_number)) + 1,
      weight_kg: excess,
      services: { ...basket.services },
      notes: basket.notes,
      subtotal: 0,
    };

    newBasketArray.push(newBasket);
  } else {
    newBasketArray[basketIndex].weight_kg = newWeight;
  }

  return newBasketArray;
}

// ============================================================================
// IRON WEIGHT VALIDATION
// ============================================================================

/**
 * Validate iron weight
 * - Must be 0 (off) or between 2-8 kg
 * - Skip if < 2 kg (don't ask user)
 */
export function normalizeIronWeight(
  weight: number
): 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  if (weight < PRICING.IRON_WEIGHT_MIN) return 0; // Skip iron
  if (weight > PRICING.IRON_WEIGHT_MAX) return 8;
  return weight as 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

// ============================================================================
// CASH CHANGE CALCULATION
// ============================================================================

/**
 * Calculate change for cash payment
 */
export function calculateChange(amountPaid: number, total: number): number {
  const change = amountPaid - total;
  return change >= 0 ? parseFloat(change.toFixed(2)) : 0;
}

/**
 * Check if amount paid is sufficient
 */
export function isAmountSufficient(amountPaid: number, total: number): boolean {
  return amountPaid >= total;
}
