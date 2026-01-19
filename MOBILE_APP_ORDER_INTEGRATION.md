# Mobile App Booking Module - Order Integration Guide

## Overview
This document provides the mobile app coding agent with all necessary information to implement the order creation process for the booking module. The mobile app uses the same backend APIs as the web-based POS system, but with pre-authenticated customers (no customer selection needed).

**Key Mobile App Workflow**:
- Customer creates order and pays via GCash (upload screenshot)
- Order created with status `pending` (awaiting cashier approval)
- `cashier_id` is NULL initially
- Push notification sent: "Order received, awaiting approval"
- Cashier approves order in manage orders webapp
- Stock is deducted upon approval
- Push notification sent: "Order approved and processing"
- Customer can view receipt on screen and via email

---

## Architecture Overview

### Order Flow
```
1. [Mobile App] Prepare Order Data
   ↓
2. GCash Payment & Screenshot Upload
   ↓
3. Create Breakdown JSON (products + baskets/services + GCash receipt placeholder)
   ↓
4. Create Handling JSON (pickup/delivery info)
   ↓
5. POST to /api/orders/transactional-create
   ↓
6. [Backend] Create order with status "pending", cashier_id = NULL
   ↓
7. [Backend] Save GCash payment info (screenshot placeholder)
   ↓
8. [Mobile App] Send push notification: "Order received, awaiting approval"
   ↓
9. [Cashier] Approves order in manage orders webapp
   ↓
10. [Backend] Deduct inventory for products
    ↓
11. [Backend] Update order status to "processing", set cashier_id, audit log
    ↓
12. [Mobile App] Push notification: "Order approved and processing"
    ↓
13. [Mobile App] Generate receipt & send email
    ↓
14. Display success/order confirmation
```

---

## Key Differences from Web POS

### Customer Selection
- **Web POS**: User can search and select customer or create new one at order time
- **Mobile App**: Customer is already authenticated (pre-logged in), use `customer_id` from auth context
- **Mobile App**: Update customer contact info only if changed

### Payment & Approval
- **Web POS**: Immediate payment in-store, cashier_id set on creation
- **Mobile App**: GCash payment first (screenshot uploaded), order created with `pending` status
- **Mobile App**: `cashier_id` is NULL initially, set by cashier during approval
- **Mobile App**: Stock deduction happens **after** cashier approval, not on creation

### Order Source
- **Web POS**: `source: "store"`
- **Mobile App**: `source: "app"`

---

## Data Structures

### Order JSON Fields Overview
All orders follow this structure (saved in `orders` table):

```typescript
{
  id: string;                           // UUID (auto-generated)
  source: "store" | "app";              // "app" for mobile
  customer_id: string;                  // UUID of authenticated user
  cashier_id: string | null;            // NULL for pending orders, set on approval
  status: OrderStatus;                  // Fulfillment workflow status
  total_amount: number;                 // Final price
  order_note: string | null;            // Optional notes
  breakdown: BreakdownJSON;             // Items, baskets, services, fees
  handling: HandlingJSON;               // Pickup/delivery logistics
  cancellation: null | CancellationJSON; // If cancelled
  created_at: string;                   // ISO timestamp
  approved_at: string | null;           // Set by cashier on approval
  completed_at: string | null;          // When all tasks done
  cancelled_at: string | null;          // If cancelled
}
```

### Order Status Values
```
"pending"         - Mobile order awaiting cashier approval (payment screenshot uploaded)
"processing"      - Approved by cashier, being worked on (stock deducted)
"for_pick-up"     - Ready for pickup
"for_delivery"    - Ready for delivery
"completed"       - All tasks done
"cancelled"       - Order cancelled (by customer or cashier)
```

### Breakdown JSON Structure

This is the most complex part. It contains all line items and pricing:

```typescript
breakdown: {
  items: [                    // Physical products (e.g., detergent, supplies)
    {
      id: string;             // UUID
      product_id: string;     // FK to products table
      product_name: string;   // Snapshot at order time
      quantity: number;
      unit_price: number;     // Price per unit
      unit_cost: number;      // Cost (for margin analysis)
      subtotal: number;       // unit_price * quantity
      discount: {
        amount: number;       // PHP amount discounted
        reason: string | null;
      }
    }
  ],
  
  baskets: [                  // Laundry baskets with services
    {
      basket_number: number;  // 1, 2, 3... (original index)
      weight: number;         // Weight in kg
      basket_notes: string | null;
      services: [
        {
          id: string;         // UUID
          service_id: string; // FK to services table
          service_name: string;
          is_premium: boolean; // Premium variant of service
          multiplier: number;  // Quantity/how many times
          rate_per_kg: number; // Price per kg (snapshot)
          subtotal: number;    // weight * rate_per_kg * multiplier
          status: ServiceStatus; // "pending" | "in_progress" | "completed" | "skipped"
          started_at: string | null;
          completed_at: string | null;
          completed_by: string | null; // Staff ID who completed
          duration_in_minutes: number | null;
        }
      ],
      total: number;          // Sum of all services in basket
    }
  ],

  fees: [                     // Additional fees
    {
      id: string;             // UUID
      type: "service_fee" | "handling_fee";
      description: string;
      amount: number;
    }
  ],

  totals: {
    product_subtotal: number;
    basket_subtotal: number;
    service_fee: number;      // PHP 40 if has service baskets
    handling_fee: number;     // Fixed ₱50 for delivery (0 if pickup only)
    tax_rate: number;         // 0.12 (12% VAT)
    tax_included: number;     // VAT amount included in subtotal
    total: number;            // Final total
  },

  payment: {
    method: "gcash";              // Always GCash for mobile app
    payment_status: "pending" | "successful" | "failed";
    amount_paid: number;          // Total amount
    change_amount: number;        // Always 0 for GCash
    completed_at: string | null;  // ISO timestamp when payment verified
    gcash_receipt: {
      screenshot_url: string | null;  // Placeholder for GCash receipt/screenshot
      transaction_id: string | null;  // GCash transaction ID if available
      verified: boolean;              // Set by cashier during approval
    }
  },

  audit_log: [
    {
      timestamp: string;      // ISO timestamp
      changed_by: string | null; // Staff/cashier ID (NULL for initial creation)
      action: string;         // Description of change
      details: object;        // Any additional data
    }
  ]
}
```

### Handling JSON Structure

```typescript
handling: {
  pickup: {
    address: string | null;         // Pickup location (e.g., customer home)
    latitude: number | null;        // For maps integration
    longitude: number | null;
    notes: string | null;           // Special instructions
    status: HandlingStatus;         // "pending" | "in_progress" | "completed" | "skipped"
    started_at: string | null;      // ISO timestamp
    completed_at: string | null;
    completed_by: string | null;    // Staff ID
    duration_in_minutes: number | null;
  },
  
  delivery: {
    address: string | null;         // Delivery location
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
    status: HandlingStatus;
    started_at: string | null;
    completed_at: string | null;
    completed_by: string | null;
    duration_in_minutes: number | null;
  }
}
```

---

## Payment & GCash Integration

### GCash Payment Flow

**Step 1: Customer Initiates Payment**
- Show GCash payment amount (order total)
- Customer pays via GCash mobile app
- Customer returns to booking app

**Step 2: Upload Payment Screenshot**
```typescript
// User uploads screenshot of GCash transaction confirmation
const screenshotFile: File; // From file picker
const formData = new FormData();
formData.append('screenshot', screenshotFile);
formData.append('orderId', orderId); // Placeholder - can be temp ID

// For now, store locally or in state
// TODO: Create /api/gcash-receipts endpoint when bucket is ready
const gcashReceiptPlaceholder = {
  screenshot_url: null,      // Will be set when bucket is available
  transaction_id: null,      // Optional: if user enters manually
  verified: false            // Set by cashier during approval
};
```

**Step 2b: GCash Receipt Storage (TODO)**
When storage bucket becomes available:
- Create `/api/gcash-receipts` endpoint to upload screenshots
- Return `screenshot_url` to be saved in `breakdown.payment.gcash_receipt.screenshot_url`
- Cashier can verify receipt during order approval

For now, use placeholder structure in breakdown. **Do NOT require screenshot upload** - just show placeholder UI.

---

## API Endpoints

### 1. Create Order (Main Endpoint)
**Endpoint**: `POST /api/orders/transactional-create`

**Request Body**:
```typescript
{
  customer: {
    id: string;               // Authenticated user ID
    phone_number: string;     // Update if changed
    email_address: string;    // Update if changed
  },
  orderPayload: {
    source: "app";
    customer_id: string;      // Same as customer.id
    cashier_id: null;         // NULL - set by cashier during approval
    status: "pending";        // Mobile orders start as pending (awaiting approval)
    total_amount: number;     // From breakdown.totals.total
    order_note: string | null;
    breakdown: BreakdownJSON; // Includes GCash receipt data
    handling: HandlingJSON;
  }
}
```

**Response** (Success):
```typescript
{
  success: true,
  orderId: string;            // UUID of created order
  order: {                    // Created order object
    id: string;
    source: string;
    customer_id: string;
    cashier_id: null;         // NULL - will be set on approval
    status: "pending";        // Awaiting cashier approval
    total_amount: number;
    order_note: string | null;
    breakdown: BreakdownJSON;
    handling: HandlingJSON;
    created_at: string;
    approved_at: null;        // Will be set on approval
  }
}
```

**Response** (Error - Insufficient Stock):
```typescript
{
  success: false,
  error: "Insufficient stock for one or more items",
  insufficientItems: [
    {
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }
  ]
}
```

### 2. Approve Order (Cashier - Manage Orders Webapp)
**Endpoint**: `POST /api/orders/{orderId}/approve`

**Request Body**:
```typescript
{
  cashier_id: string;           // Staff ID of approver
  gcash_verified: boolean;      // Whether GCash receipt was verified
  notes?: string;               // Optional notes from cashier
}
```

**Backend Logic**:
1. Validate order status is "pending" and source is "app"
2. Update order:
   - status → "processing"
   - cashier_id → provided staff ID
   - approved_at → current timestamp
   - breakdown.payment.payment_status → "successful"
   - breakdown.payment.completed_at → current timestamp
   - breakdown.payment.gcash_receipt.verified → true
   - Update audit log with approval info
3. Deduct inventory (stock reduction for all products in order)
4. Return approval response with order details
5. Trigger push notification to customer: "Order approved and processing"

**Response**:
```typescript
{
  success: true,
  orderId: string;
  order: OrderRow;           // Updated order with new status
  stockDeducted: boolean;    // Whether inventory was successfully deducted
  notificationSent: boolean; // Whether customer notification was sent
}
```

**Error Handling**:
- If already approved: `error: "Order already approved"`
- If cancelled: `error: "Order is cancelled"`
- If stock insufficient: `error: "Insufficient stock"` + `insufficientItems: [...]`

### 3. Generate Receipt
**Endpoint**: `POST /api/receipts`

**Request Body**:
```typescript
{
  receipt: CompactReceipt,   // See structure below
  orderId: string;           // From order creation response
}
```

**CompactReceipt Structure**:
```typescript
{
  orderNumber: string;       // First 8 chars of order ID (uppercase)
  timestamp: string;         // Formatted: "MM/DD/YYYY HH:MM:SS AM/PM"
  customerName: string;      // "FirstName LastName"
  customerPhone?: string;
  items: ReceiptItem[];      // All line items (products + services)
  subtotal: number;
  serviceFee: number;
  handlingFee: number;
  taxAmount: number;
  total: number;
  paymentMethod: "GCASH";
  pickup: {
    scheduled: boolean;
    address?: string;
  },
  delivery: {
    scheduled: boolean;
    address?: string;
    fee: number;
  },
  notes?: string;
}
```

**ReceiptItem Structure**:
```typescript
{
  type: "product" | "service";
  name: string;
  quantity: number;
  price: number;             // Price per unit
  lineTotal: number;         // Total for this line
  details?: string;          // e.g., "Basket 1 • 2.5kg" for services
}
```

**Response**:
```typescript
{
  success: true,
  downloadUrl: string;       // URL to text file
  filename: string;          // Generated filename
  orderId: string;
}
```

---

## Implementation Steps

### Step 1: Collect GCash Payment
```typescript
// 1. Show order total
const orderTotal = calculateTotal(breakdown);
alert(`Please pay ₱${orderTotal.toFixed(2)} via GCash`);

// 2. User completes GCash payment in their GCash app
// 3. User returns to booking app

// 4. User uploads screenshot (placeholder for now)
const screenshotFile = await pickFileFromDevice(); // File picker
const gcashScreenshotUrl = null; // Placeholder - will be set when bucket ready

// For now, store screenshot data in local state
const gcashPaymentProof = {
  screenshot: screenshotFile,
  timestamp: new Date(),
  // Don't upload yet - wait for bucket to be ready
};

// TODO: When bucket is ready, implement:
// const screenshotUrl = await uploadGCashScreenshot(screenshotFile, orderId);
```

### Step 1b: Get Authenticated User
```typescript
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();

const customerId = user.id; // Customer ID = auth user ID
// Note: DO NOT get staff ID - this is customer app, not staff
```

### Step 2: Prepare Products for Breakdown
When user selects products (e.g., supplies):
```typescript
// Store product selections as: { productId: quantity }
const orderProductCounts: Record<string, number> = {
  "prod-123": 2,  // 2 units of product with ID "prod-123"
  "prod-456": 1
};

// Fetch full product details for breakdown
const { data: products } = await supabase
  .from("products")
  .select("id, item_name, unit_price, unit_cost, quantity")
  .in("id", Object.keys(orderProductCounts));
```

### Step 3: Prepare Baskets for Breakdown
Each basket contains weight and services:
```typescript
interface Basket {
  id: string;
  name: string;              // "Basket 1", "Basket 2"
  originalIndex: number;     // 1, 2, 3... (for basket_number)
  weightKg: number;
  washCount: number;         // How many times wash? (0, 1, 2...)
  dryCount: number;
  spinCount: number;
  iron: boolean;
  fold: boolean;
  washPremium: boolean;      // Premium variant?
  dryPremium: boolean;
  notes: string;
}

// Baskets with 0 weight are filtered out
const activeBaskets = baskets.filter(b => b.weightKg > 0);
```

### Step 4: Fetch Services & Service Rates
```typescript
const { data: services } = await supabase
  .from("services")
  .select("id, name, service_type, rate_per_kg, base_duration_minutes");

// Services have types: "wash", "dry", "spin", "iron", "fold"
// Some have premium variants (name includes "Premium")
```

### Step 5: Build Breakdown JSON

This is where all calculations happen. Example helper:

```typescript
function buildBreakdownJSON(
  orderProductCounts: Record<string, number>,
  baskets: Basket[],
  products: Product[],
  services: Service[],
  handling: HandlingState,
  gcashScreenshotUrl: string | null = null
): BreakdownJSON {
  // 1. Build items array from products
  const items = Object.entries(orderProductCounts).map(([pid, qty]) => {
    const product = products.find(p => p.id === pid)!;
    return {
      id: crypto.randomUUID(),
      product_id: pid,
      product_name: product.item_name,
      quantity: qty,
      unit_price: product.unit_price,
      unit_cost: product.unit_cost ?? 0,
      subtotal: product.unit_price * qty,
      discount: { amount: 0, reason: null }
    };
  });

  // 2. Build baskets array with services
  const basketsArray = baskets
    .filter(b => b.weightKg > 0)
    .map((basket, idx) => {
      const basketServices = [];
      let basketTotal = 0;

      // For each service type, check if selected
      if (basket.washCount > 0) {
        const svc = findService(services, "wash", basket.washPremium);
        const subtotal = basket.weightKg * svc.rate_per_kg * basket.washCount;
        basketServices.push({
          id: crypto.randomUUID(),
          service_id: svc.id,
          service_name: svc.name,
          is_premium: basket.washPremium,
          multiplier: basket.washCount,
          rate_per_kg: svc.rate_per_kg,
          subtotal,
          status: "pending",
          started_at: null,
          completed_at: null,
          completed_by: null,
          duration_in_minutes: svc.base_duration_minutes * basket.washCount
        });
        basketTotal += subtotal;
      }
      // ... repeat for dry, spin, iron, fold

      return {
        basket_number: basket.originalIndex,
        weight: basket.weightKg,
        basket_notes: basket.notes || null,
        services: basketServices,
        total: basketTotal
      };
    });

  // 3. Calculate totals
  const productSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const basketSubtotal = basketsArray.reduce((s, b) => s + b.total, 0);
  const serviceFee = basketsArray.length > 0 ? 40 : 0; // PHP 40 per order
  const handlingFee = handling.deliver ? 50 : 0; // Fixed ₱50 for delivery
  
  const subtotalBeforeTax = productSubtotal + basketSubtotal + serviceFee + handlingFee;
  const taxRate = 0.12; // 12% VAT
  const taxIncluded = subtotalBeforeTax * (taxRate / (1 + taxRate));
  const total = subtotalBeforeTax;

  // 4. Build fees array
  const fees = [];
  if (serviceFee > 0) {
    fees.push({
      id: crypto.randomUUID(),
      type: "service_fee",
      description: "Service Fee",
      amount: serviceFee
    });
  }
  if (handlingFee > 0) {
    fees.push({
      id: crypto.randomUUID(),
      type: "handling_fee",
      description: "Delivery Fee",
      amount: handlingFee
    });
  }

  // 5. Build payment object
  const payment = {
    method: "gcash",
    payment_status: "pending",  // Will be set to "successful" when cashier approves
    amount_paid: total,
    change_amount: 0,
    completed_at: null,  // Will be set when payment verified
    gcash_receipt: {
      screenshot_url: gcashScreenshotUrl || null,  // Placeholder for now
      transaction_id: null,
      verified: false  // Will be set by cashier
    }
  };

  // 6. Build audit log
  const auditLog = [{
    timestamp: new Date().toISOString(),
    changed_by: null,  // No staff member yet (awaiting approval)
    action: "Order created via mobile app - pending cashier approval",
    details: { source: "app", payment_method: "gcash" }
  }];

  return {
    items,
    baskets: basketsArray,
    fees,
    totals: {
      product_subtotal: productSubtotal,
      basket_subtotal: basketSubtotal,
      service_fee: serviceFee,
      handling_fee: handlingFee,
      tax_rate: taxRate,
      tax_included: taxIncluded,
      total
    },
    payment,
    audit_log: auditLog
  };
}
```

### Step 6: Build Handling JSON

```typescript
function buildHandlingJSON(
  handling: {
    pickup: boolean;
    pickupAddress: string | null;
    deliver: boolean;
    deliveryAddress: string;
    instructions: string;
  }
): HandlingJSON {
  return {
    pickup: {
      address: handling.pickup ? handling.pickupAddress : null,
      latitude: null,     // Can be set by rider later with GPS
      longitude: null,
      notes: handling.instructions || null,
      status: (handling.pickup && handling.pickupAddress) ? "pending" : "skipped",
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null
    },
    delivery: {
      address: handling.deliver ? handling.deliveryAddress : null,
      latitude: null,     // Can be set by rider later with GPS
      longitude: null,
      notes: handling.instructions || null,
      status: (handling.deliver && handling.deliveryAddress) ? "pending" : "skipped",
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null
    }
  };
}
```

### Step 7: Note on Stock Validation
**IMPORTANT**: For mobile app orders:
- Stock is **NOT** validated before order creation
- Order is created with status "pending" regardless of stock levels
- Stock validation and deduction happens **only after** cashier approves
- If stock is insufficient when cashier tries to approve, the approval fails with error

This allows customers to submit orders even if stock is temporarily low, and cashier can manually approve or reject based on current availability.

### Step 8: Create Order via Transactional API

```typescript
async function createOrder(
  breakdown: BreakdownJSON,
  handling: HandlingJSON,
  customer: { id: string; phone_number: string; email_address: string },
  totalAmount: number
) {
  // NOTE: Mobile app orders start with status="pending" and cashier_id=null
  const orderPayloadForMobile = {
    source: "app",
    customer_id: customer.id,
    cashier_id: null,      // Will be set by cashier during approval
    status: "pending",     // Mobile orders start as pending (awaiting approval)
    total_amount: totalAmount,
    order_note: null,
    breakdown,
    handling
  };

  const response = await fetch("/api/orders/transactional-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer,
      orderPayload: orderPayloadForMobile,
    })
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.insufficientItems) {
      // Handle stock error
      console.error("Stock unavailable:", data.insufficientItems);
    }
    throw new Error(data.error || "Failed to create order");
  }

  return data.orderId;
}
```

### Step 9: Send Initial Push Notification
```typescript
// Notify customer that order was received
try {
  await sendPushNotification(customerId, {
    title: "Order Received",
    body: "Your booking has been submitted. Please wait for cashier approval.",
    data: {
      orderId,
      action: "open_order_details",
      status: "pending"
    }
  });
} catch (err) {
  console.warn("Failed to send push notification:", err);
  // Don't fail order creation if notification fails
}
```

### Step 10: Generate Receipt & Send Email
```typescript
// Generate compact receipt
const compactReceipt = generateCompactReceipt(
  orderId,
  new Date(),
  customer,
  productLines,
  basketLines,
  handling,
  { method: "gcash" },
  totals
);

// Display receipt on screen
const receiptRes = await fetch("/api/receipts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    receipt: compactReceipt,
    orderId,
  }),
});

// Send email with receipt (TODO: Create /api/email/send-receipt endpoint)
if (receiptRes.ok) {
  try {
    await fetch("/api/email/send-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customer.email_address,
        orderId,
        receipt: compactReceipt,
        status: "pending_approval"  // Let customer know it's awaiting approval
      })
    });
  } catch (emailErr) {
    console.warn("Email sending failed:", emailErr);
    // Don't block if email fails
  }
}
```

---

## Stock Management

### Mobile App Stock Flow

**On Order Creation**:
- Stock is **NOT** validated or deducted
- Order is created with status `"pending"`
- This allows orders even if stock is temporarily unavailable

**On Cashier Approval**:
1. Backend validates that all products have sufficient stock
2. If insufficient: Approval fails with `insufficientItems` error
3. If sufficient: 
   - Deducts quantities from each product
   - Logs transaction records in `product_transactions` table
   - Updates order status to `"processing"`
   - Updates audit log

**Why This Approach?**
- Customers can always submit orders (no "out of stock" blocking)
- Cashier decides whether to accept or reject based on current availability
- Provides flexibility for manual stock adjustments or special approvals

---

## Push Notifications

### Notification Events

**Event 1: Order Received**
- Triggered: Immediately after order creation
- Status: `pending`
- Message: "Order Received - Your booking has been submitted. Awaiting cashier approval."
- Data: `{ orderId, action: "open_order_details", status: "pending" }`

**Event 2: Order Approved**
- Triggered: When cashier approves the order
- Status: `processing`
- Message: "Order Approved! Your laundry is now being processed."
- Data: `{ orderId, action: "open_order_details", status: "processing" }`

**Event 3: Order Approval Failed**
- Triggered: When cashier approval fails (e.g., insufficient stock)
- Status: `failed`
- Message: "Order Could Not Be Approved - [Reason]. Please contact support."
- Data: `{ orderId, action: "open_order_details", errorDetails: insufficientItems }`

### Push Notification Implementation

```typescript
// Send on mobile app (after order creation)
async function sendOrderReceivedNotification(orderId: string) {
  await notificationService.send({
    title: "Order Received",
    body: "Your booking has been submitted. Awaiting cashier approval.",
    data: { orderId, status: "pending", action: "open_order_details" }
  });
}

// Triggered by backend when cashier approves
async function sendOrderApprovedNotification(orderId: string) {
  await notificationService.send({
    title: "Order Approved!",
    body: "Your laundry is now being processed.",
    data: { orderId, status: "processing", action: "open_order_details" }
  });
}

// Triggered by backend if approval fails
async function sendOrderApprovalFailedNotification(
  orderId: string,
  reason: string
) {
  await notificationService.send({
    title: "Order Could Not Be Approved",
    body: `${reason}. Please contact support.`,
    data: { orderId, status: "failed", action: "open_order_details" }
  });
}
```

---

## Error Handling

### Common Errors

| Scenario | Error Response | Recommended UI Action |
|----------|---|---|
| Missing customer ID | `error: "Customer ID is required"` | Show error, redirect to login |
| Missing breakdown/handling | `error: "Missing required fields"` | Check form completeness |
| GCash payment not confirmed | (Custom validation) | Require user to confirm payment before proceeding |
| Server error on creation | `error: "Internal server error"` | Retry, or escalate to support |
| Cashier approval fails (stock) | `error: "Insufficient stock"`, `insufficientItems: [...]` | Push notification sent; customer sees order status |
| Receipt generation failed | Order is created successfully; receipt fails gracefully | Show order ID, can regenerate receipt later |

---

## Testing Checklist

### Mobile App Order Creation
- [ ] GCash payment flow (screenshot placeholder showing in UI)
- [ ] Order creation with status "pending" and cashier_id = null
- [ ] Push notification sent immediately after order creation
- [ ] Receipt displayed on screen with status "Pending Approval"
- [ ] Receipt email sent to customer
- [ ] Order appears in cashier's manage orders list
- [ ] Stock is NOT deducted on order creation

### Cashier Approval Flow
- [ ] Cashier can view pending orders in manage orders webapp
- [ ] Cashier can verify GCash receipt (placeholder for now)
- [ ] Cashier can approve order (status changes to "processing")
- [ ] Stock is deducted after cashier approves
- [ ] Audit log updated with cashier info and approval timestamp
- [ ] Push notification sent to customer on approval
- [ ] Order status accessible to customer in mobile app

### Error Handling
- [ ] Stock validation rejects approval if insufficient inventory
- [ ] Push notification sent to customer if approval fails
- [ ] Error message shows which items are unavailable
- [ ] Cashier can reject order if issues found

### Features
- [ ] Order creation works with products only (no baskets)
- [ ] Order creation works with baskets only (no products)
- [ ] Order creation works with both products and baskets
- [ ] Handling JSON correctly marks pickup/delivery as pending or skipped
- [ ] Total amount calculated correctly (including 12% tax and fixed ₱50 delivery fee)
- [ ] GCash receipt placeholder structure in place (ready for bucket implementation)

---

## Implementation Checklist Before Handing to Mobile Agent

### Backend Endpoints Needed
- [x] `POST /api/orders/transactional-create` - Already exists (verify status="pending" support)
- [x] `POST /api/orders/{orderId}/approve` - **CREATED** - Cashier approval endpoint
- [x] `POST /api/orders/{orderId}/reject` - **CREATED** - Cashier rejection endpoint
- [ ] `POST /api/email/send-receipt` - **TODO** - Create email sending endpoint
- [ ] Push notification system - **Implement** - Send notifications from backend

### Manage Orders Webapp Changes
- [ ] Add filter for "pending" orders (mobile app orders awaiting approval)
- [ ] Show GCash receipt verification UI
- [ ] Add approve/reject buttons for pending orders
- [ ] Call new approve endpoint with cashier_id

### Mobile App Implementation
- [ ] GCash payment UI (link to GCash app)
- [ ] Screenshot placeholder display (don't upload yet)
- [ ] Display order with "Status: Pending Approval"
- [ ] Show receipt on screen and option to email
- [ ] Listen for push notifications (approval/rejection)
- [ ] Update order status in real-time
- [ ] Show error details if approval fails

---

## TODO Items - High Priority

### 1. `/api/orders/{orderId}/approve` Endpoint ✅ CREATED
**Location**: `src/app/api/orders/[id]/approve/route.ts`

**Functionality** (All Implemented):
- [x] Accept POST with `{ cashier_id, gcash_verified, notes? }`
- [x] Validate order is pending and source is "app"
- [x] Mark ALL baskets as approved (group approval - one basket = all approved)
- [x] Deduct inventory using existing `deductInventory()` helper
- [x] Update order status to "processing"
- [x] Set `cashier_id` and `approved_at`
- [x] Update `breakdown.payment.payment_status` to "successful"
- [x] Add audit log entry with cashier info and baskets approved count
- [x] Return success response with updated order
- [ ] Send push notification to customer: "Order Approved!"

**Key Behavior**:
- Group basket approval: When approving, ALL baskets in order marked as approved with same timestamp and cashier_id
- Stock deduction: Only happens if approval succeeds; fails if insufficient inventory
- Error handling: Returns detailed error if stock unavailable

### 2. `/api/orders/{orderId}/reject` Endpoint ✅ CREATED
**Location**: `src/app/api/orders/[id]/reject/route.ts`

**Functionality** (All Implemented):
- [x] Accept POST with `{ cashier_id, reason, notes? }`
- [x] Validate order is pending and source is "app"
- [x] Mark ALL baskets as rejected (group rejection)
- [x] Update order status to "cancelled"
- [x] Update `breakdown.payment.payment_status` to "failed"
- [x] Add audit log entry with rejection reason
- [x] Return success response with updated order
- [ ] Send push notification to customer: "Order Could Not Be Approved"

**Key Behavior**:
- Group rejection: When rejecting, ALL baskets marked rejected with same reason
- No stock deduction: Inventory never touched (order was pending, not processing)
- Audit trail: Complete details logged for customer service

### 3. Create `/api/email/send-receipt` Endpoint
**Location**: `src/app/api/email/send-receipt/route.ts`

**Functionality**:
- Accept POST with `{ email, orderId, receipt, status }`
- Format receipt as HTML email template
- Send via email service (SendGrid, AWS SES, etc.)
- Include receipt summary in email body
- Return success/error response

### 4. Implement Push Notification System
- Backend: Integrate Firebase Cloud Messaging (FCM) or similar
- Mobile app: Register device token on login
- Backend: Send notifications when order is created and approved
- Mobile app: Listen for and display notifications with deep links

### 5. Create GCash Receipt Storage (Post-MVP)
- Set up Supabase Storage bucket for screenshots
- Create `/api/gcash-receipts` endpoint
- Mobile app uploads screenshot when bucket ready
- Cashier can view receipt images during approval

---

## File References from Web POS

### Core Logic Files
1. [src/app/in/pos/logic/orderHelpers.ts](src/app/in/pos/logic/orderHelpers.ts) - Helper functions
2. [src/app/in/pos/logic/receiptGenerator.ts](src/app/in/pos/logic/receiptGenerator.ts) - Receipt formatting
3. [src/app/in/pos/logic/orderTypes.ts](src/app/in/pos/logic/orderTypes.ts) - Type definitions
4. [src/app/api/orders/inventoryHelpers.ts](src/app/api/orders/inventoryHelpers.ts) - Stock validation/deduction
5. [src/app/api/orders/transactional-create/route.ts](src/app/api/orders/transactional-create/route.ts) - Main order endpoint
6. [src/app/api/receipts/route.ts](src/app/api/receipts/route.ts) - Receipt generation

---

**Created**: 2026-01-19  
**Last Updated**: 2026-01-19  
**Mobile App Workflow**: GCash Payment → Order (pending) → Cashier Approval → Stock Deduction → Customer Notification
