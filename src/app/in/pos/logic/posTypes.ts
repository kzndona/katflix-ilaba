/**
 * posTypes.ts
 * Clean, simplified type definitions for POS Order Creation
 * 
 * Key design decisions:
 * - Per-ORDER staff service fee (not per basket)
 * - Flat service pricing (not rate_per_kg)
 * - Automatic basket creation when weight > 8kg
 * - Iron: minimum 2kg (skip if < 2kg)
 * - VAT 12% inclusive
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type ServiceType = "self_service" | "staff_service";
export type PaymentMethod = "cash" | "gcash";
export type HandlingType = "pickup" | "delivery";

// ============================================================================
// BASKET & SERVICES
// ============================================================================

export interface PricingInfo {
  name?: string;
  tier?: "basic" | "premium" | null;
  base_price: number;
  service_type?: string;
}

export interface BasketServices {
  wash: "off" | "basic" | "premium";      // Off/Basic/Premium
  wash_cycles: 1 | 2 | 3;                 // Only relevant if wash != "off"
  wash_pricing?: PricingInfo;             // Pricing info for wash service
  dry: "off" | "basic" | "premium";       // Off/Basic/Premium
  dry_pricing?: PricingInfo;              // Pricing info for dry service
  spin: boolean;                          // On/Off
  spin_pricing?: PricingInfo;             // Pricing info for spin service
  iron_weight_kg: 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 0 = off, min 2kg
  iron_pricing?: PricingInfo;             // Pricing info for iron service
  fold: boolean;                          // On/Off
  additional_dry_time_minutes: 0 | 8 | 16 | 24;  // 0, 8, 16, or 24
  additional_dry_time_pricing?: PricingInfo; // Pricing info for additional dry time
  plastic_bags: number;                   // Quantity of plastic bags
  heavy_fabrics: boolean;                 // Heavy fabrics (jeans, comforter, etc) - informational flag
  staff_service_pricing?: PricingInfo;    // Pricing info for staff service
}

export interface Basket {
  basket_number: number;                  // 1, 2, 3...
  weight_kg: number;                      // 0-8kg
  services: BasketServices;
  notes: string;                          // Per-basket laundry notes
  subtotal: number;                       // Calculated price for this basket
}

// ============================================================================
// ORDER ITEMS (PRODUCTS)
// ============================================================================

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;                     // Snapshot at order time
  total_price: number;                    // quantity * unit_price
}

// ============================================================================
// FEES
// ============================================================================

export interface Fee {
  type: "staff_service_fee" | "delivery_fee" | "vat";
  amount: number;
  description: string;
}

// ============================================================================
// BREAKDOWN JSONB (Database Storage)
// ============================================================================

export interface OrderBreakdown {
  items: OrderItem[];                     // Product purchases
  baskets: Basket[];                      // Laundry baskets with services
  fees: Fee[];                            // Service fee, delivery fee, VAT
  summary: {
    subtotal_products: number;            // Sum of all product line totals
    subtotal_services: number;            // Sum of all basket subtotals
    staff_service_fee: number;            // 40 PHP if any basket has staffService (or per order?)
    delivery_fee: number;                 // 0 if pickup, override or 50 if delivery
    subtotal_before_vat: number;          // products + services + staff fee + delivery
    vat_amount: number;                   // 12% inclusive
    loyalty_discount: number;             // If applicable
    total: number;                        // Final amount paid
  };
}

// ============================================================================
// HANDLING JSONB (Database Storage)
// ============================================================================

export interface OrderHandling {
  service_type: ServiceType;              // self_service or staff_service
  handling_type: HandlingType;            // pickup or delivery
  delivery_address: string | null;        // If delivery
  delivery_lng?: number | null;           // Delivery location longitude
  delivery_lat?: number | null;           // Delivery location latitude
  delivery_fee_override: number | null;   // Cashier override (min 50 if delivery)
  special_instructions: string;           // Order-level notes
  scheduled: boolean;                     // Whether order is scheduled for later
  scheduled_date?: string;                // ISO date format (YYYY-MM-DD) for scheduled pickup/delivery
  scheduled_time?: string;                // HH:MM format (13:00-17:00 range) for scheduled pickup/delivery
  payment_method: PaymentMethod;
  amount_paid: number;
  amount_change?: number;                 // If cash
  gcash_reference?: string;               // If GCash
}

// ============================================================================
// COMPLETE ORDER STRUCTURE (for API payload)
// ============================================================================

export interface CreateOrderPayload {
  customer_id: string | null;             // If existing customer
  customer_data?: {                       // If new customer
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
  };
  breakdown: OrderBreakdown;
  handling: OrderHandling;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface POSUIState {
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;        // Current step in workflow
  serviceType: ServiceType;               // Global choice: self or staff service
  baskets: Basket[];                      // All baskets (auto-created)
  products: OrderItem[];                  // Selected products with quantities
  customer: CustomerData | null;          // Selected/created customer
  delivery: DeliveryData;                 // Pickup/delivery details
  payment: PaymentData;                   // Cash/GCash + amounts
}

export interface CustomerData {
  id?: string;                            // If existing customer
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
  loyalty_points?: number;                // Customer's loyalty points
}

export interface DeliveryData {
  type: HandlingType;
  address?: string;                       // Required if delivery
  fee: number;                            // 50 or override
  special_instructions: string;
}

export interface PaymentData {
  method: PaymentMethod;
  amount_paid: number;
  amount_change?: number;                 // If cash
  gcash_reference?: string;               // If GCash
}

// ============================================================================
// SERVICE PRICING STRUCTURE (from database services table)
// ============================================================================

export interface Service {
  id: string;
  service_type: "wash" | "dry" | "spin" | "iron" | "fold";
  name: string;
  tier?: "basic" | "premium";             // For wash/dry
  base_price: number;                     // Per basket (not per kg)
  base_duration_minutes: number;
  is_active: boolean;
}

// ============================================================================
// PRODUCT FOR POS SELECTOR
// ============================================================================

export interface POSProduct {
  id: string;
  item_name: string;
  unit_price: number;
  quantity_in_stock: number;              // Current stock
  image_url?: string;
  reorder_level: number;
}

// ============================================================================
// CUSTOMER RESPONSE FROM API
// ============================================================================

export interface POSCustomer {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address?: string;
  loyalty_points: number;
}

// ============================================================================
// API RESPONSE
// ============================================================================

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  receipt?: {
    order_id: string;
    customer_name: string;
    items: OrderItem[];
    baskets: Basket[];
    total: number;
    payment_method: PaymentMethod;
    change?: number;
  };
  error?: string;
}
