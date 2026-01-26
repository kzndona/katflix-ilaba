# API & Database Schema Review

**Date:** January 26, 2026  
**Status:** Ready for Overhaul Planning

---

## Executive Summary

You have **two conflicting API patterns** for order creation:

1. **POST /api/pos/newOrder** - Legacy endpoint (old POS/Mobile format) with flat structure
2. **POST /api/orders/transactional-create** - New endpoint (POS only) with JSONB breakdown/handling

The **transactional-create endpoint is incomplete** and has mismatches with the database schema. The database schema itself is well-structured but some endpoints don't fully populate the JSONB objects.

---

## Current Database Schema

### Core Tables

#### `customers`

```sql
✓ Properly indexed (phone, email, auth_id)
✓ Loyalty points tracking
✓ Auth integration via auth_id
- No address field (address is stored but not utilized)
- No order history/preferences table
```

#### `orders`

```sql
✓ JSONB columns for breakdown & handling
✓ Comprehensive status checks
✓ Timestamps (created, approved, completed, cancelled)
✓ Good FK relationships (customer, cashier)
✓ GIN indexes on JSONB columns
- Missing: draft_at, paused_at (for incomplete orders)
- Missing: modification_history tracking
```

#### `machines`

```sql
✓ Machine type validation (wash, dry, iron)
✓ Status tracking (available, running, maintenance)
- Issue: NOT LINKED to baskets in orders.breakdown
  (breakdown.baskets doesn't reference machine_id)
```

#### `services`

```sql
✓ Service type validation
✓ Rate per kg for pricing
✓ Base duration for time tracking
✓ Premium tier support (via name string matching - FRAGILE)
- Issue: Service variant/tier stored in NAME field (string matching is error-prone)
```

#### `products`

```sql
✓ Stock management (quantity, reorder_level)
✓ Cost tracking for margin analysis
✓ Image URLs
- Issue: No sku/barcode field for inventory tracking
- Issue: No stock transaction history table ✓ EXISTS (product_transactions)
```

#### `product_transactions`

```sql
✓ Tracks add/remove/consume/adjust changes
✓ Links to order for audit
✓ Staff assignment
- Good for audit trail
```

#### `staff_roles` & `roles`

```sql
✓ Role-based access (admin, cashier, attendant, rider)
✓ Proper FK relationships
- Used for permissions
```

#### `issues`

```sql
✓ Issue tracking (open, resolved, cancelled)
✓ Severity levels
✓ Assignment to staff
- Useful for quality control
```

---

## Current API Endpoints Overview

### 🔴 CONFLICTING PATTERNS

#### Pattern A: POST /api/pos/newOrder (Legacy)

**Used by:** Old POS, Mobile app  
**Format:** Flat arrays (baskets, products, payments)

```typescript
{
  customerId: string
  total: number
  baskets: [
    {
      weight: number
      subtotal: number
      services: [
        { service_id, rate, subtotal }
      ]
      notes: string
    }
  ]
  products: [
    { product_id, quantity, unit_price, subtotal }
  ]
  payments: [
    { amount, method, reference }
  ]
  source: "pos" | "mobile"
}
```

**Issues:**

- Creates flat `order_baskets` & `order_products` tables (not JSONB)
- No handling/delivery info
- No comprehensive audit trail
- Different structure than database schema expects

#### Pattern B: POST /api/orders/transactional-create (New)

**Used by:** New POS (usePOSState)  
**Format:** JSONB breakdown + handling

```typescript
{
  customer: {
    id: string;
    phone_number: string;
    email_address: string;
  }
  orderPayload: {
    source: "store";
    customer_id: string;
    cashier_id: string;
    status: "processing";
    total_amount: number;
    breakdown: {
      /* JSONB */
    }
    handling: {
      /* JSONB */
    }
  }
}
```

**Issues:**

- ❌ `handling` object in UI is incomplete (pickup/deliver booleans, not HandlingStage objects)
- ❌ `building` with cashier but not mapping machines to baskets
- ❌ Loyalty discount fields added to orderPayload but not in database schema
- ✓ Proper inventory deduction
- ✓ Customer update on order creation

### Other Relevant Endpoints

#### GET /api/orders/:id

- ✓ Fetches order with customer/staff details
- ✓ Returns full JSONB objects
- ❌ No caching/etag support

#### PATCH /api/orders/:id/service-status

- ✓ Updates service status in breakdown
- ✓ Adds audit log entry
- ⚠️ Uses array indices (basket_index, service_index) - fragile if structure changes

#### POST /api/receipts

- ✓ Generates plaintext receipt
- ✓ Saves to file system
- ⚠️ File-based storage (not scalable, no versioning)

#### POST /api/email/send-receipt

- ✓ Uses Resend API
- ✓ Sends formatted receipt
- ✓ HTML + plaintext variants

#### POST /api/customer/saveCustomer

- ✓ Creates/updates customers
- ✓ Auth user invitation
- ✓ Loyalty points handling
- ⚠️ Auth invitation errors don't block customer creation

#### POST /api/auth/reset-password-request

- ✓ Password reset flow
- Used for staff/customer auth

#### Analytics Endpoints

- POST /api/analytics/orders
- POST /api/analytics/customers
- POST /api/analytics/products
- POST /api/analytics/revenue
- POST /api/analytics/transactions/orders
- POST /api/analytics/transactions/products

---

## Database Schema vs API Mismatch Analysis

### 1. HANDLING JSONB Structure

**Database Schema expects:**

```typescript
{
  pickup: HandlingStage;
  delivery: HandlingStage;
}

// Where HandlingStage = {
//   address: string | null
//   latitude: number | null
//   longitude: number | null
//   notes: string | null
//   status: 'pending' | 'in_progress' | 'completed' | 'skipped'
//   started_at: ISO timestamp | null
//   completed_at: ISO timestamp | null
//   completed_by: staff.id | null
//   duration_in_minutes: number | null
// }
```

**Current UI provides:**

```typescript
{
  pickup: boolean;
  deliver: boolean;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryFee: number;
  courierRef: string;
  instructions: string;
}
```

**Conversion happens in `buildHandlingJSON()` but:**

- ❌ Pickup toggle doesn't map to address/status correctly
- ❌ `deliveryFee` not stored in JSONB (where should it go?)
- ❌ `courierRef` is lost (no field in schema)

### 2. BREAKDOWN Structure

**Database schema expects:**

```typescript
{
  items: OrderItem[]        // Products
  baskets: OrderBasket[]    // Laundry baskets with services
  fees: OrderFee[]          // Service fee, handling fee
  discounts: OrderDiscount[]
  payment: OrderPayment
  summary: OrderSummary
  audit_log: AuditLogEntry[]
}
```

**Current usePOSState builds:**

```typescript
{
  items: []; // Products ✓
  baskets: []; // Baskets ✓
  fees: []; // ✓ Service fee
  payment: {
    // ✓ Method + amount
    method: "cash" | "gcash";
    amount_paid: number;
    change: number;
    completed_at: timestamp;
    payment_status: "successful";
  }
  summary: {
  } // ✓ Subtotals, VAT, totals
  audit_log: []; // ✓ Initialization only
}
```

**Issues:**

- ❌ Handling fee stored separately, not in breakdown.fees
- ❌ Loyalty discount stored on orderPayload, not in breakdown.discounts
- ❌ No machine_id in baskets (can't track which machine used)

### 3. Service Definition

**Database constraint:**

```sql
service_type IN ('pickup', 'wash', 'spin', 'dry', 'iron', 'fold', 'delivery')
```

**Current approach:**

- Uses `name` field for premium tier detection
- `getServiceByType()` matches string: `name.toLowerCase().includes("premium")`
- ❌ FRAGILE: if service name changes, logic breaks

**Should have:**

- `variant` or `tier` column ('basic', 'premium')
- OR separate service variants with FK relationship

### 4. Machines

**Database has machines table but:**

- ❌ No link to baskets in orders
- ❌ breakdown.baskets doesn't include machine_id
- ❌ Can't track which washing machine processed which order
- ❌ Attendants don't know which basket goes in which machine

---

## Inventory Management Flow

### Current Implementation (transactional-create)

1. **Validate stock** - `validateStockAvailability()`
2. **Deduct inventory** - `deductInventory()` on `products` table
3. **Create product_transactions** - audit trail
4. **Create order** - with breakdown containing item details

### Issues

- ❌ No rollback if order creation fails after deduction
- ✓ Validates before deducting (good)
- ⚠️ No low-stock notifications
- ⚠️ No reorder automation

---

## Loyalty Points Flow

### Current Implementation

1. **Load points** on customer select
2. **Calculate discount** based on points (10pts = 10%, 20pts = 15%)
3. **Store points used** in orderPayload
4. **Award new points** if no discount used (1 point per order)

### Issues

- ❌ Loyalty info stored on orderPayload, not in breakdown.discounts
- ⚠️ Discount calculated client-side, not server-validated
- ⚠️ No historical tracking of point changes per order
- ⚠️ No tier-based benefits (only point-based)

---

## Receipt Generation Flow

### Current Implementation

1. **generateReceiptFromDB()** - fetches order, formats as plaintext
2. **formatReceiptAsPlaintext()** - in pos/logic/receiptGenerator.ts
3. **POST /api/receipts** - saves to file system
4. **POST /api/email/send-receipt** - sends via Resend

### Issues

- ⚠️ File-based storage (not scalable)
- ⚠️ Receipts not linked in orders table
- ⚠️ No receipt versioning (only one receipt per order)
- ✓ Email integration works well
- ⚠️ No SMS receipt option

---

## Issues Identified

### 🔴 CRITICAL

1. **Handling Data Mismatch**
   - UI state doesn't match database schema
   - Delivery fee not stored in JSONB
   - Courier reference lost
   - **Impact:** Orders save but handling data incomplete

2. **No Machine Tracking**
   - Baskets in breakdown don't link to machines
   - Attendants can't see which basket → which machine
   - **Impact:** Can't optimize laundry workflow

3. **Premium Service Logic**
   - Premium tier determined by string matching
   - `name.includes("premium")` is fragile
   - **Impact:** Tier changes break pricing logic

4. **Loyalty Discount Not Validated**
   - Calculated client-side only
   - Could be manipulated in network request
   - Not stored in breakdown for audit
   - **Impact:** Security risk

5. **Conflicting API Patterns**
   - Two different order creation formats
   - Old endpoint (newOrder) still exists & might be used
   - **Impact:** Maintenance burden, confusion

### 🟡 MEDIUM

1. **No Draft Order Support**
   - Can't save incomplete orders
   - No resume functionality
   - **Impact:** Cashier loses data if POS crashes

2. **Receipt Storage**
   - File-based, not database-linked
   - No versioning or archival
   - **Impact:** Scaling issue, recovery difficult

3. **Service Status Updates**
   - Uses array indices (basket_index, service_index)
   - Breaks if structure changes
   - **Impact:** Fragile update logic

4. **Loyalty Points on OrderPayload**
   - Should be in breakdown.discounts
   - Mixed concerns (API payload vs database structure)
   - **Impact:** Inconsistent data model

5. **No Order Modification Tracking**
   - Can't see edit history
   - No cancellation reason stored
   - **Impact:** Poor audit trail

### 🟢 MINOR

1. Courier reference field not used
2. GCash receipt URL optional but not utilized
3. Analytics endpoints exist but full implementation unclear
4. No pagination on customer search
5. Product image_url not displayed in POS
6. No inventory low-stock warnings

---

## Database Optimization Opportunities

```sql
-- Missing indexes
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_breakdown_items ON orders USING GIN (((breakdown -> 'items')));

-- Missing tables
CREATE TABLE order_drafts (
  id UUID PRIMARY KEY,
  customer_id UUID FK,
  breakdown JSONB,
  handling JSONB,
  saved_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by UUID FK
);

CREATE TABLE service_variants (
  service_id UUID FK,
  variant TEXT ('basic', 'premium'),
  rate_per_kg NUMERIC,
  created_at TIMESTAMP
);
```

---

## Endpoint Health Checklist

| Endpoint                              | Status        | Issues                                      |
| ------------------------------------- | ------------- | ------------------------------------------- |
| POST /api/orders/transactional-create | ⚠️ Incomplete | Handling mismatch, loyalty not in breakdown |
| POST /api/orders                      | ⚠️ Works      | Legacy format, creates flat tables          |
| GET /api/orders/:id                   | ✓ Good        | Missing etag/caching                        |
| PATCH /api/orders/:id/service-status  | ⚠️ Fragile    | Uses array indices                          |
| POST /api/receipts                    | ⚠️ Works      | File storage, not scalable                  |
| POST /api/email/send-receipt          | ✓ Good        | Working as intended                         |
| POST /api/customer/saveCustomer       | ✓ Good        | Auth handling could fail silently           |
| POST /api/pos/newOrder                | ⚠️ Legacy     | Conflicting with transactional-create       |
| POST /api/auth/\*                     | ✓ Works       | Basic functionality                         |
| /api/analytics/\*                     | ? Unclear     | Full implementation not reviewed            |

---

## JSONB Structure Reference

### Sample breakdown.json (from attachment)

```json
{
  "fees": [
    { "id", "type": "service_fee", "amount": 10, "description" }
  ],
  "items": [],
  "baskets": [
    {
      "basket_number": 1,
      "weight": 8,
      "services": [
        {
          "id": "uuid",
          "service_id": "uuid",
          "service_name": "Wash Basic",
          "is_premium": false,
          "multiplier": 1,
          "rate_per_kg": 8.75,
          "subtotal": 70,
          "status": "completed",
          "started_at": "ISO",
          "completed_at": "ISO",
          "completed_by": "staff-id"
        }
      ],
      "total": 200,
      "status": "completed"
    }
  ],
  "payment": {
    "method": "cash",
    "amount_paid": 240,
    "change": 4.8,
    "payment_status": "successful",
    "completed_at": "ISO"
  },
  "summary": {
    "subtotal_products": null,
    "subtotal_services": 200,
    "service_fee": 10,
    "vat_amount": 25.2,
    "vat_rate": 0.12,
    "vat_model": "inclusive",
    "grand_total": 235.2
  },
  "audit_log": [
    {
      "action": "created",
      "timestamp": "ISO",
      "changed_by": "staff-id"
    }
  ]
}
```

### Sample handling.json (from attachment)

```json
{
  "pickup": {
    "address": null,
    "latitude": null,
    "longitude": null,
    "notes": null,
    "status": "skipped",
    "started_at": null,
    "completed_at": null,
    "completed_by": null,
    "duration_in_minutes": null
  },
  "delivery": {
    "address": null,
    "latitude": null,
    "longitude": null,
    "notes": null,
    "status": "skipped",
    "started_at": null,
    "completed_at": null,
    "completed_by": null,
    "duration_in_minutes": null
  }
}
```

---

## Migration Path Recommendations

### Phase 1: Fix Current Mismatches

1. Fix handling JSONB building (UI → database alignment)
2. Add machine_id to breakdown.baskets
3. Move loyalty discount to breakdown.discounts
4. Add service variant column (basic/premium)
5. Add delivery_fee to breakdown.fees

### Phase 2: Complete New Endpoint

1. Complete POST /api/orders/transactional-create
2. Deprecate POST /api/pos/newOrder
3. Add draft order support
4. Add order modification tracking

### Phase 3: Infrastructure

1. Move receipt storage to database/cloud
2. Add analytics aggregations
3. Add inventory management API
4. Add staff assignment endpoints

---

## Data Flow Diagram (Current)

```
POS UI (usePOSState)
    ↓
POST /api/orders/transactional-create
    ├─ Update customer
    ├─ Validate/deduct inventory
    └─ POST /api/orders (internal call)
        ├─ Verify customer/staff
        ├─ Insert order with breakdown + handling
        ├─ Award loyalty points
        └─ Return orderId
    ├─ Generate receipt (DB query)
    ├─ Send email
    └─ Show receipt modal

Subsequent: PATCH /api/orders/:id/service-status (update service status in breakdown)
```

---

## Questions for Clarification

1. **Machine assignment** - Should baskets be assigned to specific machines in breakdown?
2. **Handling flow** - Are pickup/delivery timestamps tracked by riders?
3. **Service variants** - Should premium tiers be separate database records?
4. **Loyalty system** - Is point accumulation the only tier, or will there be membership tiers?
5. **Draft orders** - Is this a requirement?
6. **Order modifications** - Should completed orders be editable?
7. **Receipt archival** - Should receipts be stored in S3/database?
8. **API versioning** - Should we maintain backward compatibility with newOrder endpoint?

---

**This document is ready for overhaul planning. Please provide the specific changes you want to implement.**
