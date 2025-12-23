/**
 * orderTypes.ts
 * Complete type definitions for the new order schema (JSONB-based)
 */

// ============================================================================
// BASE/COMMON TYPES
// ============================================================================

export type OrderSource = 'store' | 'app';

export type OrderStatus = 
  | 'pending'
  | 'for_pick-up'
  | 'processing'
  | 'for_delivery'
  | 'completed'
  | 'cancelled';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type PaymentMethod = 'cash' | 'gcash';

export type PaymentStatus = 'successful' | 'processing' | 'failed';

// ============================================================================
// HANDLING JSONB TYPES
// ============================================================================

export interface HandlingStage {
  address: string | null;
  latitude: number | null;           // For Google Maps integration
  longitude: number | null;          // For Google Maps integration
  notes: string | null;
  status: StageStatus;
  started_at: string | null;         // ISO timestamp
  completed_at: string | null;       // ISO timestamp
  completed_by: string | null;       // staff.id FK
  duration_in_minutes: number | null;
}

export interface HandlingJSON {
  pickup: HandlingStage;
  delivery: HandlingStage;
}

// ============================================================================
// BREAKDOWN JSONB TYPES
// ============================================================================

// Items (products purchased)
export interface OrderItem {
  id: string;                         // UUID
  product_id: string;                 // products.id FK
  product_name: string;
  quantity: number;
  unit_price: number;                 // Snapshot at order time
  unit_cost: number;                  // Snapshot at order time (for margin analysis)
  subtotal: number;
  discount: {
    amount: number;
    reason: string | null;
  };
}

// Services within a basket
export interface BasketService {
  id: string;                         // UUID
  service_id: string;                 // services.id FK
  service_name: string;
  is_premium: boolean;                // Only for wash/dry
  multiplier: number;                 // Quantity of this service
  rate_per_kg: number;                // Snapshot at order time
  subtotal: number;
  status: StageStatus;
  started_at: string | null;          // ISO timestamp
  completed_at: string | null;        // ISO timestamp
  completed_by: string | null;        // staff.id FK
  duration_in_minutes: number | null;
}

// Baskets (laundry baskets with services)
export interface OrderBasket {
  basket_number: number;
  weight: number;                     // kg
  basket_notes: string | null;
  services: BasketService[];
  total: number;                      // Sum of all services subtotals
}

// Fees
export interface OrderFee {
  id: string;                         // UUID
  type: 'service_fee' | 'handling_fee';
  description: string;
  amount: number;
}

// Discounts
export interface OrderDiscount {
  id: string;                         // UUID
  type: 'loyalty' | 'manager' | 'promotional';
  applied_to: 'handling_fee' | 'service_fee' | 'order_total';
  value_type: 'percentage' | 'fixed_amount';
  value: number;                      // If percentage: 5 means 5%. If fixed: 50 means PHP50
  reason: string | null;
  applied_amount: number;             // Actual PHP deducted
}

// Summary (invoice breakdown)
export interface OrderSummary {
  subtotal_products: number | null;
  subtotal_services: number | null;
  handling: number | null;            // Delivery fee
  service_fee: number | null;
  discounts: number | null;           // Total discounts applied
  vat_rate: number;                   // Default 0.12 (12%)
  vat_amount: number;
  vat_model: 'inclusive';             // VAT is included in grand_total
  grand_total: number;                // VAT inclusive
}

// Payment
export interface OrderPayment {
  method: PaymentMethod;
  amount_paid: number;
  change: number;
  reference_number?: string;          // GCash reference
  payment_status: PaymentStatus;
  completed_at: string | null;        // ISO timestamp
}

// Audit log entry
export interface AuditLogEntry {
  action: 'created' 
    | 'service_status_changed' 
    | 'handling_started' 
    | 'handling_completed' 
    | 'payment_processed' 
    | 'order_approved' 
    | 'order_cancelled';
  timestamp: string;                  // ISO timestamp
  changed_by: string;                 // staff.id FK
  
  // Context fields (optional, depend on action)
  service_path?: string;              // e.g., "baskets.0.services.1"
  from_status?: string;               // Previous status
  to_status?: string;                 // New status
  handling_stage?: 'pickup' | 'delivery';
  duration_minutes?: number;
  payment_method?: string;
  payment_amount?: number;
  approval_reason?: string;
  cancellation_reason?: string;
  details?: Record<string, any>;
}

// Complete breakdown JSONB
export interface BreakdownJSON {
  items: OrderItem[];
  baskets: OrderBasket[];
  fees: OrderFee[];
  discounts: OrderDiscount[] | null;
  summary: OrderSummary;
  payment: OrderPayment;
  audit_log: AuditLogEntry[];
}

// ============================================================================
// CANCELLATION JSONB TYPES
// ============================================================================

export type CancellationReason = 
  | 'customer_request' 
  | 'payment_failed' 
  | 'damaged' 
  | 'other';

export type RefundStatus = 'pending' | 'processed' | 'failed';

export interface CancellationJSON {
  reason: CancellationReason;
  notes: string | null;
  requested_at: string;               // ISO timestamp
  requested_by: string | null;        // staff.id FK or null if customer
  refund_status: RefundStatus;
}

// ============================================================================
// COMPLETE ORDER TYPES
// ============================================================================

export interface OrderRow {
  id: string;                         // UUID
  source: OrderSource;
  customer_id: string;                // customers.id FK
  cashier_id: string | null;          // staff.id FK
  status: OrderStatus;
  created_at: string;                 // ISO timestamp
  approved_at: string | null;         // ISO timestamp
  completed_at: string | null;        // ISO timestamp
  cancelled_at: string | null;        // ISO timestamp
  total_amount: number;
  order_note: string | null;
  handling: HandlingJSON;
  breakdown: BreakdownJSON;
  cancellation: CancellationJSON | null;
  updated_at?: string;                // ISO timestamp (if tracked)
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// POST /api/customers
export interface CreateCustomerRequest {
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address?: string;
  birthdate?: string;                 // ISO date
  gender?: 'male' | 'female' | 'other';
  address?: string;
}

export interface CustomerResponse {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address?: string;
  birthdate?: string;
  gender?: string;
  address?: string;
  created_at: string;
}

// POST /api/orders
export interface CreateOrderRequest {
  source: OrderSource;
  customer_id: string;
  cashier_id: string;                 // Authenticated user
  status: OrderStatus;
  total_amount: number;
  order_note?: string;
  breakdown: BreakdownJSON;
  handling: HandlingJSON;
}

export interface CreateOrderResponse {
  success: boolean;
  order: OrderRow;
  error?: string;
}

// PATCH /api/orders/:id/service-status
export interface UpdateServiceStatusRequest {
  basket_index: number;
  service_index: number;
  status: StageStatus;
  completed_by?: string;              // staff.id FK
}

export interface UpdateServiceStatusResponse {
  success: boolean;
  order: OrderRow;
  error?: string;
}

// PATCH /api/orders/:id/handling-status
export interface UpdateHandlingStatusRequest {
  stage: 'pickup' | 'delivery';
  status: StageStatus;
  completed_by?: string;              // staff.id FK
  duration_minutes?: number;
}

export interface UpdateHandlingStatusResponse {
  success: boolean;
  order: OrderRow;
  error?: string;
}

// ============================================================================
// UI STATE TYPES (for usePOSState)
// ============================================================================

// Simplified handling state for UI
export interface HandlingState {
  pickup: boolean;
  deliver: boolean;
  pickupAddress: string | null;
  deliveryAddress: string;
  deliveryFee: number;
  courierRef: string;
  instructions: string;
}

// Product selection state
export interface ProductSelectionState {
  [productId: string]: number;        // productId -> quantity
}
