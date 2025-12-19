/**
 * orderHelpers.ts
 * Helper functions to build JSONB structures for orders
 */

import {
  HandlingJSON,
  HandlingStage,
  BreakdownJSON,
  OrderItem,
  OrderBasket,
  BasketService,
  OrderFee,
  OrderSummary,
  OrderPayment,
  AuditLogEntry,
  HandlingState,
  PaymentMethod,
} from './orderTypes';
import {
  Basket,
  Product,
  LaundryService,
} from './types';

// ============================================================================
// HANDLING JSONB BUILDERS
// ============================================================================

/**
 * Build handling JSONB from UI state
 */
export const buildHandlingJSON = (
  handlingState: HandlingState,
  instructions: string
): HandlingJSON => {
  return {
    pickup: {
      address: handlingState.pickup ? handlingState.pickupAddress : null,
      latitude: null,  // Can be set by rider later with coordinates
      longitude: null,
      notes: instructions || null,
      status: handlingState.pickup ? 'pending' : 'skipped',
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null,
    },
    delivery: {
      address: handlingState.deliver ? handlingState.deliveryAddress : null,
      latitude: null,
      longitude: null,
      notes: instructions || null,
      status: handlingState.deliver ? 'pending' : 'skipped',
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null,
    },
  };
};

/**
 * Build single handling stage update
 */
export const buildHandlingStageUpdate = (
  currentStage: HandlingStage,
  newStatus: 'in_progress' | 'completed' | 'skipped',
  completedBy?: string
): HandlingStage => {
  const updated = { ...currentStage };

  updated.status = newStatus;

  // Set started_at if this is the first action
  if (!updated.started_at && newStatus === 'in_progress') {
    updated.started_at = new Date().toISOString();
  }

  // Set completed info if completing
  if (newStatus === 'completed') {
    updated.started_at = updated.started_at || new Date().toISOString();
    updated.completed_at = new Date().toISOString();
    updated.completed_by = completedBy || null;

    // Calculate duration if both times available
    if (updated.started_at && updated.completed_at) {
      const start = new Date(updated.started_at).getTime();
      const end = new Date(updated.completed_at).getTime();
      updated.duration_in_minutes = Math.round((end - start) / 60000);
    }
  }

  return updated;
};

// ============================================================================
// BREAKDOWN JSONB BUILDERS
// ============================================================================

/**
 * Build breakdown.items array from product selections
 */
export const buildBreakdownItems = (
  orderProductCounts: Record<string, number>,
  products: Product[]
): OrderItem[] => {
  return Object.entries(orderProductCounts).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const subtotal = product.unit_price * quantity;

    return {
      id: crypto.randomUUID(),
      product_id: productId,
      product_name: product.item_name,
      quantity,
      unit_price: product.unit_price, // Snapshot at order time
      subtotal,
      discount: {
        amount: 0,
        reason: null,
      },
    };
  });
};

/**
 * Build single basket service from basket state
 */
const buildBasketService = (
  serviceId: string,
  serviceName: string,
  isPremium: boolean,
  multiplier: number,
  ratePerKg: number,
  weight: number,
  baseDurationMinutes: number
): BasketService => {
  const subtotal = weight * ratePerKg * multiplier;
  const durationMinutes = baseDurationMinutes * multiplier;

  return {
    id: crypto.randomUUID(),
    service_id: serviceId,
    service_name: serviceName,
    is_premium: isPremium,
    multiplier,
    rate_per_kg: ratePerKg, // Snapshot at order time
    subtotal,
    status: 'pending',
    started_at: null,
    completed_at: null,
    completed_by: null,
    duration_in_minutes: durationMinutes,
  };
};

/**
 * Build breakdown.baskets array from basket state
 */
export const buildBreakdownBaskets = (
  baskets: Basket[],
  services: LaundryService[]
): OrderBasket[] => {
  return baskets.map((basket) => {
    const basketServices: BasketService[] = [];
    let basketTotal = 0;

    // Wash service
    if (basket.washCount > 0) {
      const washService = getServiceByType(services, 'wash', basket.washPremium);
      if (washService) {
        const service = buildBasketService(
          washService.id,
          washService.name,
          basket.washPremium,
          basket.washCount,
          washService.rate_per_kg,
          basket.weightKg,
          washService.base_duration_minutes
        );
        basketServices.push(service);
        basketTotal += service.subtotal;
      }
    }

    // Dry service
    if (basket.dryCount > 0) {
      const dryService = getServiceByType(services, 'dry', basket.dryPremium);
      if (dryService) {
        const service = buildBasketService(
          dryService.id,
          dryService.name,
          basket.dryPremium,
          basket.dryCount,
          dryService.rate_per_kg,
          basket.weightKg,
          dryService.base_duration_minutes
        );
        basketServices.push(service);
        basketTotal += service.subtotal;
      }
    }

    // Spin service
    if (basket.spinCount > 0) {
      const spinService = getServiceByType(services, 'spin', false);
      if (spinService) {
        const service = buildBasketService(
          spinService.id,
          spinService.name,
          false,
          basket.spinCount,
          spinService.rate_per_kg,
          basket.weightKg,
          spinService.base_duration_minutes
        );
        basketServices.push(service);
        basketTotal += service.subtotal;
      }
    }

    // Iron service
    if (basket.iron) {
      const ironService = getServiceByType(services, 'iron', false);
      if (ironService) {
        const service = buildBasketService(
          ironService.id,
          ironService.name,
          false,
          1,
          ironService.rate_per_kg,
          basket.weightKg,
          ironService.base_duration_minutes
        );
        basketServices.push(service);
        basketTotal += service.subtotal;
      }
    }

    // Fold service
    if (basket.fold) {
      const foldService = getServiceByType(services, 'fold', false);
      if (foldService) {
        const service = buildBasketService(
          foldService.id,
          foldService.name,
          false,
          1,
          foldService.rate_per_kg,
          basket.weightKg,
          foldService.base_duration_minutes
        );
        basketServices.push(service);
        basketTotal += service.subtotal;
      }
    }

    return {
      basket_number: basket.originalIndex,
      weight: basket.weightKg,
      basket_notes: basket.notes || null,
      services: basketServices,
      total: basketTotal,
    };
  });
};

/**
 * Helper: Get service by type and premium flag
 */
const getServiceByType = (
  services: LaundryService[],
  serviceType: string,
  isPremium: boolean
): LaundryService | undefined => {
  const matches = services.filter((s) => s.service_type === serviceType);

  if (matches.length === 0) {
    return undefined;
  }

  if (isPremium) {
    return (
      matches.find((s) => s.name.toLowerCase().includes('premium')) ||
      matches[0]
    );
  }

  return (
    matches.find((s) => !s.name.toLowerCase().includes('premium')) ||
    matches[0]
  );
};

/**
 * Build breakdown.fees array
 */
export const buildFeesArray = (
  basketCount: number,
  deliveryFee: number,
  serviceFeePerBasket: number
): OrderFee[] => {
  const fees: OrderFee[] = [];

  if (basketCount > 0) {
    fees.push({
      id: crypto.randomUUID(),
      type: 'service_fee',
      description: `Service fee (${basketCount} basket${basketCount > 1 ? 's' : ''})`,
      amount: basketCount * serviceFeePerBasket,
    });
  }

  if (deliveryFee > 0) {
    fees.push({
      id: crypto.randomUUID(),
      type: 'handling_fee',
      description: 'Delivery fee',
      amount: deliveryFee,
    });
  }

  return fees;
};

/**
 * Build breakdown.summary object
 */
export const buildOrderSummary = (
  productSubtotal: number,
  serviceSubtotal: number,
  fees: OrderFee[],
  discounts: number = 0,
  vatRate: number = 0.12
): OrderSummary => {
  const serviceFee = fees
    .filter((f) => f.type === 'service_fee')
    .reduce((sum, f) => sum + f.amount, 0);

  const handlingFee = fees
    .filter((f) => f.type === 'handling_fee')
    .reduce((sum, f) => sum + f.amount, 0);

  const subtotalBeforeTax = productSubtotal + serviceSubtotal + serviceFee + handlingFee - discounts;
  const vatAmount = subtotalBeforeTax * vatRate;
  const grandTotal = subtotalBeforeTax + vatAmount;

  return {
    subtotal_products: productSubtotal > 0 ? productSubtotal : null,
    subtotal_services: serviceSubtotal > 0 ? serviceSubtotal : null,
    handling: handlingFee > 0 ? handlingFee : null,
    service_fee: serviceFee > 0 ? serviceFee : null,
    discounts: discounts > 0 ? discounts : null,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    vat_model: 'inclusive',
    grand_total: grandTotal,
  };
};

/**
 * Build breakdown.payment object
 */
export const buildOrderPayment = (
  method: PaymentMethod,
  amountPaid: number,
  total: number,
  referenceNumber?: string
): OrderPayment => {
  return {
    method,
    amount_paid: amountPaid,
    change: amountPaid - total,
    reference_number: referenceNumber || undefined,
    payment_status: 'processing', // Set to successful after confirmation
    completed_at: null,
  };
};

/**
 * Build complete breakdown JSONB
 */
export const buildBreakdownJSON = (
  orderProductCounts: Record<string, number>,
  baskets: Basket[],
  products: Product[],
  services: LaundryService[],
  handlingState: HandlingState,
  paymentMethod: PaymentMethod,
  amountPaid: number,
  serviceFeePerBasket: number,
  vatRate: number = 0.12
): BreakdownJSON => {
  // Build items
  const items = buildBreakdownItems(orderProductCounts, products);
  const productSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Build baskets and services
  const breakdownBaskets = buildBreakdownBaskets(baskets, services);
  const serviceSubtotal = breakdownBaskets.reduce((sum, b) => sum + b.total, 0);

  // Build fees
  const deliveryFee = handlingState.deliver ? handlingState.deliveryFee : 0;
  const fees = buildFeesArray(baskets.length, deliveryFee, serviceFeePerBasket);

  // Build summary
  const summary = buildOrderSummary(productSubtotal, serviceSubtotal, fees, 0, vatRate);

  // Build payment
  const payment = buildOrderPayment(paymentMethod, amountPaid, summary.grand_total);

  // Build initial audit log entry
  const auditLog: AuditLogEntry[] = [
    {
      action: 'created',
      timestamp: new Date().toISOString(),
      changed_by: '', // Will be set by caller (cashier_id)
    },
  ];

  return {
    items,
    baskets: breakdownBaskets,
    fees,
    discounts: null,
    summary,
    payment,
    audit_log: auditLog,
  };
};

/**
 * Add audit log entry to breakdown
 */
export const addAuditLogEntry = (
  breakdown: BreakdownJSON,
  entry: AuditLogEntry
): BreakdownJSON => {
  return {
    ...breakdown,
    audit_log: [
      ...breakdown.audit_log,
      {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
      },
    ],
  };
};

/**
 * Update service status in breakdown
 */
export const updateServiceStatusInBreakdown = (
  breakdown: BreakdownJSON,
  basketIndex: number,
  serviceIndex: number,
  newStatus: 'in_progress' | 'completed' | 'skipped',
  completedBy?: string,
  durationMinutes?: number
): BreakdownJSON => {
  const updated = JSON.parse(JSON.stringify(breakdown)); // Deep clone

  const service = updated.baskets[basketIndex]?.services[serviceIndex];
  if (!service) {
    throw new Error(
      `Service not found at baskets[${basketIndex}].services[${serviceIndex}]`
    );
  }

  const fromStatus = service.status;

  // Update service object directly
  if (!service.started_at && newStatus === 'in_progress') {
    service.started_at = new Date().toISOString();
  }

  if (newStatus === 'completed') {
    service.started_at = service.started_at || new Date().toISOString();
    service.completed_at = new Date().toISOString();
    service.completed_by = completedBy || null;

    // Use provided duration or calculate from timestamps
    if (durationMinutes) {
      service.duration_in_minutes = durationMinutes;
    } else if (service.started_at && service.completed_at) {
      const start = new Date(service.started_at).getTime();
      const end = new Date(service.completed_at).getTime();
      service.duration_in_minutes = Math.round((end - start) / 60000);
    }
  }

  service.status = newStatus;

  // Add audit log entry
  updated.audit_log.push({
    action: 'service_status_changed',
    service_path: `baskets.${basketIndex}.services.${serviceIndex}`,
    from_status: fromStatus,
    to_status: newStatus,
    timestamp: new Date().toISOString(),
    changed_by: completedBy || '',
  });

  return updated;
};

/**
 * Update handling status in orders table
 */
export const updateHandlingStatusInOrder = (
  handling: HandlingJSON,
  stage: 'pickup' | 'delivery',
  newStatus: 'in_progress' | 'completed' | 'skipped',
  completedBy?: string,
  durationMinutes?: number
): HandlingJSON => {
  const updated = JSON.parse(JSON.stringify(handling)); // Deep clone

  const stageObj = updated[stage];
  if (!stageObj) {
    throw new Error(`Handling stage ${stage} not found`);
  }

  const updatedStage = buildHandlingStageUpdate(stageObj, newStatus, completedBy);
  
  // Apply duration override if provided
  if (durationMinutes && newStatus === 'completed') {
    updatedStage.duration_in_minutes = durationMinutes;
  }

  return {
    ...updated,
    [stage]: updatedStage,
  };
};
