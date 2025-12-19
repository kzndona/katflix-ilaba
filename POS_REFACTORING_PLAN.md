# POS Refactoring: Current → New Schema

## Overview

This document outlines how the current POS system will be refactored to work with the new 8-table schema, specifically focusing on how data flows from UI state → database operations.

---

## Current System Architecture

### Data Flow (Current)

```
POS Component
  ↓
usePOSState Hook (all state in memory)
  ├─ products (Product[])
  ├─ customer (Customer | null)
  ├─ baskets (Basket[])
  ├─ orderProductCounts (Record<string, number>)
  ├─ handling (pickup/delivery flags)
  ├─ payment (method, amount)
  └─ services (LaundryService[])
  ↓
computeReceipt() - calculates totals
  ↓
saveOrder() - POST /api/pos/newOrder
  ├─ creates orders row
  ├─ inserts baskets table
  ├─ inserts basket_services table
  ├─ inserts order_products table
  ├─ inserts payments table
  └─ deducts from products table
```

### Database Schema (Current - Being Replaced)

```sql
orders
├─ baskets (1:M)
│  └─ basket_services (1:M)
├─ order_products (1:M)
├─ payments (1:M)
└─ order_status_history (1:M)
```

---

## New System Architecture

### Data Flow (New)

```
POS Component
  ↓
usePOSState Hook (same structure, same memory state)
  ├─ products (Product[]) - same
  ├─ customer (Customer | null) - now validated with DB
  ├─ baskets (Basket[]) - same, used to build JSON
  ├─ orderProductCounts (Record<string, number>) - same
  ├─ handling (pickup/delivery config) - same
  ├─ payment (method, amount) - same
  └─ services (LaundryService[]) - same
  ↓
computeReceipt() - builds breakdown JSONB (NEW)
  ├─ items array (from orderProductCounts)
  ├─ baskets array with services (from baskets state)
  ├─ fees array
  ├─ discounts array
  ├─ summary object
  └─ payment object
  ↓
saveOrder() - POST /api/orders (CREATE)
  ├─ Validate customer exists (or create if new)
  ├─ Build complete breakdown JSONB
  ├─ Build complete handling JSONB
  ├─ Insert single orders row with JSONB columns
  ├─ Log product_transactions (one per product qty)
  ├─ Update products.quantity (deduct)
  └─ Add audit_log entry to breakdown
```

### Database Schema (New)

```sql
orders
├─ breakdown (JSONB - contains items, baskets, services, fees, discounts, summary, payment, audit_log)
├─ handling (JSONB - contains pickup and delivery stages)
├─ cancellation (JSONB - if cancelled)
└─ customer (FK)

product_transactions
├─ product_id (FK)
├─ order_id (FK)
├─ change_type ('consume')
└─ quantity
```

---

## Key Changes

### 1. Customer Management

**Current:**

```typescript
// Customer state in memory, optionally save to DB
const [customer, setCustomer] = useState<Customer | null>(null);

// Can be partial (just name/phone in POS)
if (!customer.id) {
  // New customer, may or may not be saved
}
```

**New:**

```typescript
// MUST check/create customer before proceeding
const [customer, setCustomer] = useState<Customer | null>(null);

// REQUIRED: Customer must have record in DB
if (!customer.id) {
  // Call POST /api/customers to create first
  const newCustomer = await createCustomer({
    first_name,
    last_name,
    phone_number,
    email_address, // optional
    birthdate, // optional
    gender, // optional
    address, // optional
  });
  setCustomer(newCustomer);
}

// NOW customer has customer_id from DB
// Stored in breakdown and handling as FK reference
```

**Process:**

```
1. User searches for customer
2. If found → select existing customer
3. If not found → show "Create New" option
4. If create → POST /api/customers → get customer.id back
5. Now proceed with order (customer.id required)
```

**API Endpoint:**

```typescript
POST /api/customers
Request:
{
  first_name: string,
  last_name: string,
  phone_number: string,
  email_address?: string,
  birthdate?: date,
  gender?: 'male' | 'female' | 'other',
  address?: string
}
Response:
{
  id: UUID,
  first_name,
  last_name,
  phone_number,
  email_address,
  birthdate,
  gender,
  address,
  created_at
}
```

---

### 2. Handling State

**Current:**

```typescript
const [handling, setHandling] = useState({
  pickup: true, // boolean
  deliver: false, // boolean
  pickupAddress: "", // string
  deliveryAddress: "", // string
  deliveryFee: 50, // number
  courierRef: "", // string
  instructions: "", // string
});
```

**New - In Memory (Same):**

```typescript
// Same state for UI
const [handling, setHandling] = useState({
  pickup: true,
  deliver: false,
  pickupAddress: "",
  deliveryAddress: "",
  deliveryFee: 50,
  courierRef: "",
  instructions: "",
});
```

**New - In Database (JSONB structure):**

```json
{
  "pickup": {
    "address": "Katflix Store, Manila",
    "latitude": 14.5995,
    "longitude": 120.9842,
    "notes": "Leave at counter",
    "status": "pending",
    "started_at": null,
    "completed_at": null,
    "completed_by": null,
    "duration_in_minutes": null
  },
  "delivery": {
    "address": "Customer address",
    "latitude": 14.6091,
    "longitude": 121.0245,
    "notes": "Ring doorbell",
    "status": "pending",
    "started_at": null,
    "completed_at": null,
    "completed_by": null,
    "duration_in_minutes": null
  }
}
```

**Transformation Function:**

```typescript
const buildHandlingJSON = (handling) => ({
  pickup: {
    address: handling.pickup ? handling.pickupAddress : null,
    latitude: null, // Can be set by rider later
    longitude: null,
    notes: handling.instructions,
    status: handling.pickup ? "pending" : "skipped",
    started_at: null,
    completed_at: null,
    completed_by: null,
    duration_in_minutes: null,
  },
  delivery: {
    address: handling.deliver ? handling.deliveryAddress : null,
    latitude: null,
    longitude: null,
    notes: handling.instructions,
    status: handling.deliver ? "pending" : "skipped",
    started_at: null,
    completed_at: null,
    completed_by: null,
    duration_in_minutes: null,
  },
});
```

---

### 3. Products Management

**Current:**

```typescript
// Load all products at component mount
const [products, setProducts] = useState<Product[]>([]);

// Track user's selection in orderProductCounts
const [orderProductCounts, setOrderProductCounts] = useState<
  Record<string, number>
>({});

// At receipt: build product lines from counts and product data
const productLines = Object.entries(orderProductCounts).map(([pid, qty]) => {
  const p = products.find((x) => x.id === pid);
  return {
    id: pid,
    name: p.item_name,
    qty,
    price: p.unit_price,
    lineTotal: p.unit_price * qty,
  };
});

// At save: POST creates order_products rows
// Then deducts from products.quantity manually
```

**New:**

```typescript
// Same loading and state
const [products, setProducts] = useState<Product[]>([]);
const [orderProductCounts, setOrderProductCounts] = useState<
  Record<string, number>
>({});

// At receipt: build breakdown.items array (same logic)
const breakdownItems = Object.entries(orderProductCounts).map(([pid, qty]) => {
  const p = products.find((x) => x.id === pid);
  return {
    id: crypto.randomUUID(), // NEW: line item UUID
    product_id: pid,
    product_name: p.item_name,
    quantity: qty,
    unit_price: p.unit_price, // Snapshot at order time
    subtotal: p.unit_price * qty,
    discount: {
      amount: 0,
      reason: null,
    },
  };
});

// At save:
// 1. Insert breakdown with items array
// 2. For each product in order: INSERT INTO product_transactions
// 3. For each product: UPDATE products SET quantity -= qty
```

**Product Transactions (NEW):**

```typescript
// For each product in the order
for (const [productId, qty] of Object.entries(orderProductCounts)) {
  // Create audit log entry
  await supabase.from("product_transactions").insert({
    product_id: productId,
    order_id: orderId,
    staff_id: cashierId,
    change_type: "consume",
    quantity: qty,
    reason: `Consumed in order ${orderId}`,
    created_at: new Date().toISOString(),
  });

  // Deduct from inventory
  await supabase
    .from("products")
    .update({ quantity: db.raw("quantity - ?", [qty]) })
    .eq("id", productId);
}
```

**API Endpoint (GET products):**

```typescript
GET /api/products?is_active=true
Response:
{
  products: [
    {
      id: UUID,
      item_name: string,
      unit_price: number,
      quantity: number,  // Current stock
      is_active: boolean,
      created_at: timestamp
    }
  ]
}
```

---

### 4. Services Management

**Current:**

```typescript
// Load all services at component mount
const [services, setServices] = useState<LaundryService[]>([]);

// At receipt: map services to basket services by type and premium flag
const basketLines = baskets.map((basket) => {
  const serviceBreakdown = {};
  if (basket.washCount > 0) {
    serviceBreakdown.wash = basket.washCount;
  }
  // ... similar for dry, spin, iron, fold

  const services = [];
  // Build service objects from serviceBreakdown

  return {
    id: basket.id,
    services, // Array of service objects
    total: calculateBasketTotal(services),
  };
});

// At save: POST creates basket_services rows
```

**New:**

```typescript
// Same loading
const [services, setServices] = useState<LaundryService[]>([]);

// At receipt: build breakdown.baskets[].services array
const breakdownBaskets = baskets.map((basket, basketIndex) => {
  const basketServices = [];

  // Wash service
  if (basket.washCount > 0) {
    const washService = getServiceByType("wash", basket.washPremium);
    basketServices.push({
      id: crypto.randomUUID(),
      service_id: washService.id,
      service_name: washService.name,
      is_premium: basket.washPremium,
      multiplier: basket.washCount,
      rate_per_kg: washService.rate_per_kg, // Snapshot
      subtotal: basket.weightKg * washService.rate_per_kg * basket.washCount,
      status: "pending",
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: washService.base_duration_minutes * basket.washCount,
    });
  }

  // Similar for dry, spin, iron, fold...

  return {
    basket_number: basket.originalIndex,
    weight: basket.weightKg,
    basket_notes: basket.notes,
    services: basketServices,
    total: basketServices.reduce((sum, s) => sum + s.subtotal, 0),
  };
});

// At save: all services in breakdown - NO separate insert
```

**API Endpoint (GET services):**

```typescript
GET /api/services?is_active=true
Response:
{
  services: [
    {
      id: UUID,
      service_type: 'wash' | 'dry' | 'spin' | 'iron' | 'fold' | 'pickup' | 'delivery',
      name: string,
      base_duration_minutes: number,
      rate_per_kg: number,
      is_active: boolean,
      created_at: timestamp
    }
  ]
}
```

---

### 5. Receipt Calculation

**Current:**

```typescript
const computeReceipt = useMemo(() => {
  // Product lines
  const productLines = [...];
  const productSubtotal = productLines.reduce((s, l) => s + l.lineTotal, 0);

  // Basket/service lines
  const basketLines = [...];
  const serviceSubtotal = basketLines.reduce((s, l) => s + l.total, 0);

  // Fees
  const serviceFee = basketLines.length * PRICING.serviceFeePerBasket;
  const deliveryFee = handling.deliver ? handling.deliveryFee : 0;

  // Totals
  const subtotal = productSubtotal + serviceSubtotal + deliveryFee;
  const vat = subtotal * PRICING.taxRate;
  const total = subtotal + vat;

  return {
    productLines,
    basketLines,
    productSubtotal,
    serviceSubtotal,
    serviceFee,
    deliveryFee,
    subtotal,
    vat,
    total
  };
}, [orderProductCounts, baskets, products, handling]);
```

**New - Same Logic, Different Output:**

```typescript
const computeReceipt = useMemo(() => {
  // Build breakdown JSONB object (NEW)
  const breakdown = {
    items: buildBreakdownItems(), // From orderProductCounts
    baskets: buildBreakdownBaskets(), // From baskets state
    fees: buildFeesArray(), // Calculated
    discounts: null, // Can be added later
    summary: {
      subtotal_products: productSubtotal,
      subtotal_services: serviceSubtotal,
      handling: deliveryFee,
      service_fee: serviceFee,
      discounts: [],
      vat_rate: 0.12,
      vat_amount:
        (productSubtotal + serviceSubtotal + serviceFee + deliveryFee) * 0.12,
      vat_model: "inclusive",
      grand_total: total, // VAT inclusive
    },
    payment: {
      method: payment.method,
      amount_paid: payment.amountPaid || 0,
      change: (payment.amountPaid || 0) - total,
      reference_number: payment.referenceNumber || null,
      payment_status: "processing",
      completed_at: null,
    },
  };

  // Also return for UI display (same as before)
  return {
    productLines,
    basketLines,
    productSubtotal,
    serviceSubtotal,
    serviceFee,
    deliveryFee,
    subtotal,
    vat,
    total,
    breakdown, // NEW: the JSONB to be stored
  };
}, [orderProductCounts, baskets, products, handling, payment]);
```

**Key Change:** `computeReceipt` now builds the complete `breakdown` JSONB object that will be stored in the database.

---

### 6. Order Creation & Saving

**Current:**

```typescript
const saveOrder = async () => {
  // Create order row
  const order = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      total_amount: computeReceipt.total,
      status: "completed", // Hard-coded
      source: "store",
    })
    .select()
    .single();

  const orderId = order.id;

  // Insert baskets
  for (const basket of baskets) {
    const b = await supabase
      .from("baskets")
      .insert({
        order_id: orderId,
        basket_number: basket.originalIndex,
        weight: basket.weightKg,
        status: "processing",
      })
      .select()
      .single();

    // Insert basket_services
    // ... nested loop for services
  }

  // Insert order_products
  for (const [productId, qty] of Object.entries(orderProductCounts)) {
    await supabase.from("order_products").insert({
      order_id: orderId,
      product_id: productId,
      quantity: qty,
    });
  }

  // Deduct from inventory
  // ... manual updates
};
```

**New:**

```typescript
const saveOrder = async () => {
  // 1. Validate customer exists (create if needed)
  let customerId = customer.id;
  if (!customerId) {
    const newCustomer = await createCustomer(customer);
    customerId = newCustomer.id;
  }

  // 2. Build complete breakdown JSONB
  const breakdown = computeReceipt.breakdown;

  // 3. Add initial audit log entry
  breakdown.audit_log = [
    {
      action: "created",
      timestamp: new Date().toISOString(),
      changed_by: cashierId,
    },
  ];

  // 4. Build complete handling JSONB
  const handling = buildHandlingJSON(handleingState);

  // 5. Create order with ALL data in one INSERT
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      source: "store",
      customer_id: customerId,
      cashier_id: cashierId,
      status: "processing", // Or 'completed' if no baskets
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString(), // Auto-approve for POS
      total_amount: computeReceipt.total,
      breakdown: breakdown,
      handling: handling,
      cancellation: null,
    })
    .select()
    .single();

  if (error) throw error;
  const orderId = order.id;

  // 6. Log product transactions (one per product qty)
  const productTransactions = Object.entries(orderProductCounts).map(
    ([productId, qty]) => ({
      product_id: productId,
      order_id: orderId,
      staff_id: cashierId,
      change_type: "consume",
      quantity: qty,
      reason: `Consumed in order ${orderId}`,
      created_at: new Date().toISOString(),
    })
  );

  if (productTransactions.length > 0) {
    await supabase.from("product_transactions").insert(productTransactions);
  }

  // 7. Deduct from product inventory
  for (const [productId, qty] of Object.entries(orderProductCounts)) {
    await supabase
      .from("products")
      .update({
        quantity: raw("quantity - ?", [qty]),
        last_updated: new Date().toISOString(),
      })
      .eq("id", productId);
  }

  // 8. Clear POS state
  resetPOS();

  return orderId;
};
```

**API Endpoint (POST /api/orders - CREATE):**

```typescript
POST /api/orders

Request:
{
  source: 'store' | 'app',
  customer_id: UUID,
  cashier_id: UUID,
  status: 'processing' | 'completed',
  total_amount: number,
  breakdown: {
    items: [...],
    baskets: [...],
    fees: [...],
    discounts: [...],
    summary: {...},
    payment: {...}
  },
  handling: {
    pickup: {...},
    delivery: {...}
  }
}

Response:
{
  success: true,
  order: {
    id: UUID,
    customer_id: UUID,
    status: 'processing',
    created_at: timestamp,
    breakdown: {...},
    handling: {...}
  }
}
```

---

### 7. Service Status Updates (Post-Order)

**Current:** Not supported - status is only in memory or as processing/completed

**New - Updating Service Status:**

```typescript
// Endpoint: PATCH /api/orders/:id/service-status
const updateServiceStatus = async (
  orderId: UUID,
  basketIndex: number,
  serviceIndex: number,
  newStatus: "in_progress" | "completed",
  completedBy: UUID
) => {
  const { data: order } = await supabase
    .from("orders")
    .select("breakdown")
    .eq("id", orderId)
    .single();

  // Get current service
  const currentService =
    order.breakdown.baskets[basketIndex].services[serviceIndex];

  // Build updated breakdown with JSONB operations
  let updatedBreakdown = order.breakdown;

  // Update service status
  updatedBreakdown.baskets[basketIndex].services[serviceIndex].status =
    newStatus;
  updatedBreakdown.baskets[basketIndex].services[serviceIndex].started_at =
    currentService.started_at || new Date().toISOString();

  if (newStatus === "completed") {
    updatedBreakdown.baskets[basketIndex].services[serviceIndex].completed_at =
      new Date().toISOString();
    updatedBreakdown.baskets[basketIndex].services[serviceIndex].completed_by =
      completedBy;
  }

  // Add audit log entry
  updatedBreakdown.audit_log = [
    ...(updatedBreakdown.audit_log || []),
    {
      action: "service_status_changed",
      service_path: `baskets.${basketIndex}.services.${serviceIndex}`,
      from_status: currentService.status,
      to_status: newStatus,
      timestamp: new Date().toISOString(),
      changed_by: completedBy,
    },
  ];

  // Update order
  await supabase
    .from("orders")
    .update({
      breakdown: updatedBreakdown,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
};
```

**API Endpoint (PATCH /api/orders/:id/service-status):**

```typescript
PATCH /api/orders/:id/service-status

Request:
{
  basket_index: number,
  service_index: number,
  status: 'in_progress' | 'completed',
  completed_by: UUID
}

Response:
{
  success: true,
  order: { ...full updated order... }
}
```

---

## Process Flow Summary

### Create Order Flow

```
1. Customer Selection
   ├─ Search for existing customer
   ├─ If not found: Create new customer (POST /api/customers)
   └─ customer.id now exists in state

2. Set Handling Info
   ├─ User selects pickup/delivery
   ├─ Enter address, fee, notes
   └─ Transform to handling JSONB structure

3. Add Products
   ├─ GET /api/products (initial load)
   ├─ User adds quantities to orderProductCounts
   └─ Transform to breakdown.items array

4. Add Baskets & Services
   ├─ User creates baskets
   ├─ User configures services per basket
   └─ Transform to breakdown.baskets[].services[] array

5. Calculate Receipt
   ├─ computeReceipt() builds breakdown JSONB
   ├─ Includes items, baskets, fees, discounts, summary, payment
   └─ Add initial audit_log entry

6. Save Order
   ├─ POST /api/orders with complete breakdown & handling
   ├─ Create product_transactions for inventory tracking
   ├─ Deduct from products.quantity
   └─ Clear POS state

7. Audit Trail
   └─ breakdown.audit_log captures all operations
```

### Update Service Status Flow

```
1. Attendant clicks on service in order
2. Changes status (pending → in_progress → completed)
3. PATCH /api/orders/:id/service-status
4. System automatically:
   ├─ Sets started_at (first time)
   ├─ Sets completed_at (on completion)
   ├─ Records completed_by (who did it)
   ├─ Adds audit_log entry
   └─ Recalculates order status if all services completed
```

---

## Audit Trail Example

```json
{
  "id": "order-123",
  "breakdown": {
    "items": [...],
    "baskets": [...],
    "summary": {...},
    "payment": {...},
    "audit_log": [
      {
        "action": "created",
        "timestamp": "2025-12-19T09:00:00Z",
        "changed_by": "cashier-uuid"
      },
      {
        "action": "service_status_changed",
        "service_path": "baskets.0.services.0",
        "from_status": "pending",
        "to_status": "in_progress",
        "timestamp": "2025-12-19T09:15:00Z",
        "changed_by": "attendant-uuid"
      },
      {
        "action": "service_completed",
        "service_path": "baskets.0.services.0",
        "from_status": "in_progress",
        "to_status": "completed",
        "timestamp": "2025-12-19T09:45:00Z",
        "changed_by": "attendant-uuid"
      },
      {
        "action": "payment_processed",
        "method": "cash",
        "amount": 5000,
        "timestamp": "2025-12-19T10:00:00Z",
        "changed_by": "cashier-uuid"
      }
    ]
  }
}
```

Can query this: `SELECT breakdown->'audit_log' FROM orders WHERE id = 'order-123'`

---

## Data Validation & Constraints

### At Order Creation

- ✅ Customer exists (create if not)
- ✅ Cashier exists (authenticated user)
- ✅ At least 1 product OR 1 basket with service
- ✅ If basket: must have weight > 0
- ✅ If basket: must have at least 1 service
- ✅ Payment method specified
- ✅ Handling (pickup or delivery) specified

### At Service Status Update

- ✅ Service exists at specified indices
- ✅ Status transition valid (pending→in_progress→completed, or skip any)
- ✅ Completed_by staff exists and is active
- ✅ Can only update service if order status allows

### At Order Cancellation

- ✅ Order status must be cancellable (not already completed)
- ✅ Reason must be specified
- ✅ Inventory restored (credit back to products)
- ✅ Refund status tracked

---

## Key Differences Summary

| Aspect                 | Current                    | New                                                   |
| ---------------------- | -------------------------- | ----------------------------------------------------- |
| Customer               | May not be saved           | MUST be saved to DB first                             |
| Baskets Table          | Separate table             | In breakdown JSONB                                    |
| Basket Services        | Separate table             | In breakdown.baskets[].services[]                     |
| Order Products         | Separate table             | In breakdown.items[]                                  |
| Payments               | Separate table             | In breakdown.payment                                  |
| Inventory Log          | Manual deduction           | product_transactions table                            |
| Service Status Updates | Not supported              | PATCH /api/orders/:id/service-status                  |
| Audit Trail            | order_status_history table | breakdown.audit_log array                             |
| Order Immutability     | Editable                   | Immutable items/baskets, editable services/timestamps |

---

## To Implement

1. Update `usePOSState.tsx`
   - Add `buildBreakdownJSON()` function
   - Add `buildHandlingJSON()` function
   - Update `computeReceipt()` to return breakdown object
   - Update `saveOrder()` to POST to new endpoint

2. Create/Update API Endpoints
   - `POST /api/customers` - Create customer
   - `POST /api/orders` - Create order (replaces /api/pos/newOrder)
   - `GET /api/orders/:id` - Read order
   - `PATCH /api/orders/:id/service-status` - Update service status
   - `PATCH /api/orders/:id/handling-status` - Update handling status

3. Update POS Components
   - `paneCustomer.tsx` - Add customer creation flow
   - `paneReceipt.tsx` - Update for new breakdown structure
   - Other components mostly unchanged

4. Create Helper Functions
   - `addAuditLog()` - Append to audit_log array
   - `calculateOrderStatus()` - Determine if order is completeable
   - `validateBaskets()` - Same as before

5. Database Helpers
   - Function to query order with full breakdown
   - Function to query product inventory history
   - Function to list orders with status filters
