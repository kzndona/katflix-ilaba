# Schema Design Review & Critique

**Date:** January 26, 2026  
**Status:** Design Validation

---

## Current Design Issues

### 1. 🔴 REDUNDANCY: `is_staff_service` on Both order Row AND handling JSONB

**Current Design:**

```sql
orders table:
  - is_staff_service BOOLEAN  -- Row column

handling JSONB:
  - is_self_service: boolean  -- Inside JSONB
```

**Problem:**

- Same data in two places
- Which is source of truth?
- If they diverge, which wins?
- More maintenance burden

**Example confusion:**

```
orders.is_staff_service = true
orders.handling.is_self_service = false
↑ Which one is correct?
```

---

### 2. 🔴 SEPARATION: Why are `breakdown` and `handling` separate?

**Current Design:**

- `breakdown` JSONB = all order pricing/items/payment details
- `handling` JSONB = pickup/delivery logistics

**Questions this raises:**

- Are they really separate concerns?
- Both exist together from step 0-6
- Both needed when creating order
- Both needed when displaying order

**Problem:**

- Mentally split when thinking about an order
- Have to query/update two JSONB columns for same logical entity
- Conceptually, "handling" is part of "order" not separate

**Example - typical query:**

```sql
SELECT breakdown, handling FROM orders WHERE id = '...'
-- Always need both together
```

---

### 3. 🟡 STRUCTURE: `special_instructions` - Where Should It Live?

**Current Design:**

- In `breakdown` JSONB
- Maybe in `handling` JSONB too?

**Problem:**

- Is it laundry-specific instructions (in breakdown)?
- Or delivery instructions (in handling)?
- Or both?

**Example:**

```
Special instructions = "Use cold water only"
↑ This is laundry instructions, belongs in breakdown

Special instructions = "Leave at door, call before arrival"
↑ This is delivery instructions, belongs in handling
```

---

### 4. 🟡 QUERYING: Inefficient Access Patterns

**Current Design - Getting all order info:**

```sql
SELECT breakdown, handling FROM orders WHERE id = '...';
-- Get two separate JSONB columns
-- Have to parse both client-side
-- Have to know both structures
```

**What if we unified it?**

```sql
SELECT order_data FROM orders WHERE id = '...';
-- Get ONE JSONB column
-- Single structure to parse
-- Everything together
```

---

## Proposed Redesign

### Option A: Unified JSONB Column (Simpler)

```sql
orders table:
  id UUID PRIMARY KEY
  customer_id UUID FK
  cashier_id UUID FK
  source TEXT ('store', 'app')
  status TEXT (pending, processing, completed, cancelled)
  created_at TIMESTAMP
  updated_at TIMESTAMP
  cancelled_at TIMESTAMP
  order_data JSONB  -- Everything inside here
  cancellation JSONB -- Only if cancelled
```

**order_data JSONB structure:**

```json
{
  "items": [
    /* products ordered */
  ],
  "baskets": [
    /* laundry services */
  ],
  "fees": [
    /* service charge, delivery fee */
  ],
  "discounts": [
    /* loyalty discount */
  ],
  "payment": {
    "method": "cash|gcash",
    "amount_paid": 600.0,
    "change": 50.0,
    "payment_status": "successful",
    "completed_at": "2026-01-26T10:30:00Z"
  },
  "summary": {
    "subtotal_products": 6.0,
    "subtotal_services": 405.0,
    "subtotal_before_fees": 411.0,
    "service_charge": 40.0,
    "delivery_fee": 50.0,
    "subtotal_before_discount": 501.0,
    "vat_rate": 0.12,
    "vat_amount": 56.25,
    "grand_total_before_discount": 501.0,
    "loyalty_discount_amount": 0.0,
    "grand_total": 501.0
  },
  "special_instructions": {
    "laundry": "Use cold water only. Separate colors.",
    "delivery": "Leave at door. Call before arrival."
  },
  "handling": {
    "is_self_service": false,
    "delivery_fee_override": null,
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
      "address": "123 Main St",
      "latitude": null,
      "longitude": null,
      "notes": null,
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "completed_by": null,
      "duration_in_minutes": null
    }
  },
  "audit_log": [
    {
      "action": "created",
      "timestamp": "2026-01-26T10:30:00Z",
      "changed_by": "staff-uuid"
    }
  ]
}
```

**Advantages:**

- ✅ Single JSONB column = one source of truth
- ✅ No redundant columns
- ✅ Clear structure (special_instructions split: laundry vs delivery)
- ✅ Easier to query: `SELECT order_data FROM orders WHERE id = '...'`
- ✅ Easier to update: modify single JSONB, not multiple columns
- ✅ Everything about order in one place

**Disadvantages:**

- ⚠️ Slightly larger JSONB (not a real problem)
- ⚠️ Can't index individual fields as easily (but GIN index still works)

---

### Option B: Keep Two JSONBs But Clean Up (Middle Ground)

```sql
orders table:
  id UUID PRIMARY KEY
  customer_id UUID FK
  cashier_id UUID FK
  source TEXT
  status TEXT
  created_at TIMESTAMP
  updated_at TIMESTAMP
  cancelled_at TIMESTAMP
  breakdown JSONB     -- Items, services, fees, discounts, payment, summary, audit
  handling JSONB      -- Pickup/delivery logistics only
  cancellation JSONB
```

**breakdown JSONB:**

```json
{
  "items": [],
  "baskets": [],
  "fees": [],
  "discounts": [],
  "payment": {},
  "summary": {},
  "audit_log": []
}
```

**handling JSONB:**

```json
{
  "is_self_service": false,
  "delivery_fee_override": null,
  "special_instructions": {
    "laundry": "...",
    "delivery": "..."
  },
  "pickup": {...},
  "delivery": {...}
}
```

**Advantages:**

- ✅ Logical separation (pricing vs logistics)
- ✅ Special instructions in handling (where it's used)
- ✅ No redundant columns
- ✅ Still queryable: `SELECT breakdown, handling FROM orders`

**Disadvantages:**

- ⚠️ Always need to fetch both columns
- ⚠️ Mental overhead of two structures
- ⚠️ Less cohesive

---

## My Recommendation: Option A (Unified)

**Why?**

1. **Single source of truth** - No ambiguity
2. **Simpler mental model** - One JSONB = one order record
3. **Easier updates** - Modify single column, not multiple
4. **Cleaner code** - One structure to parse in API/UI
5. **Supabase-friendly** - Better JSON query performance with one column
6. **Future-proof** - If you need more order data, it all goes in one place

**The Cost?**

- Slightly larger JSONB (negligible)
- Slightly less efficient for specific queries on breakdown-only data (rare)

---

## Current vs Proposed

### Current Schema Issues:

```sql
orders:
  id
  customer_id
  cashier_id
  source
  status
  breakdown JSONB     ← Items, services, fees, payment
  handling JSONB      ← Pickup/delivery
  is_staff_service BOOLEAN  ← REDUNDANT (already in handling)
```

### Proposed Schema (Cleaner):

```sql
orders:
  id
  customer_id
  cashier_id
  source
  status
  created_at
  updated_at
  cancelled_at
  order_data JSONB    ← Everything unified
  cancellation JSONB  ← Only if cancelled
```

---

## Other Questions to Answer

### Q1: Should `total_amount` be on orders row? | ANSWER: YES

**Current:** Yes, orders.total_amount = numeric

**Question:** Is this redundant with order_data.summary.grand_total?

**My opinion:**

- ✅ Keep it on orders row
- Better for querying (index on total_amount for analytics)
- Faster to sort/filter orders by amount
- Denormalization is fine here for performance

**So:**

```sql
orders:
  ...
  total_amount NUMERIC(10,2)  -- Denormalized from order_data
  order_data JSONB
```

### Q2: Should we index order_data? | ASNWER: OK

**Current:** Yes, GIN indexes on breakdown and handling

**If unified:**

```sql
CREATE INDEX idx_orders_data_gin
ON orders USING GIN (order_data);
```

**Also useful:**

```sql
-- Query by payment method
CREATE INDEX idx_order_payment_method
ON orders USING GIN ((order_data -> 'payment'::text));

-- Query by loyalty discount
CREATE INDEX idx_order_loyalty_discount
ON orders USING GIN ((order_data -> 'discounts'::text));

-- Query by service charge (self-service vs staff-service)
CREATE INDEX idx_order_self_service
ON orders USING GIN ((order_data -> 'handling'::text));
```

### Q3: What about order_note field? ASNWER: LETS DO YOUR OPINION

**Current:** orders.order_note exists but unclear when used

**My opinion:**

- Remove orders.order_note column
- Put it in order_data.handling.special_instructions or notes
- No need for both

---

## Final Recommendation

### Updated Migration:

```sql
-- SIMPLIFIED ORDERS TABLE
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS order_note,
  DROP COLUMN IF EXISTS is_staff_service;

-- Add total_amount if not exists (for analytics)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);

-- Rename breakdown to order_data for clarity
-- OR: Add new order_data column and migrate data

-- Keep handling as-is but ensure it has all needed fields:
-- {
--   "is_self_service": boolean,
--   "delivery_fee_override": null | number,
--   "special_instructions": { "laundry": string, "delivery": string },
--   "pickup": { ... },
--   "delivery": { ... }
-- }

-- Add comprehensive GIN index
CREATE INDEX idx_orders_order_data_gin
ON public.orders USING GIN (order_data);
```

---

## Decision Point

**Which approach do you prefer?**

- **Option A:** Unified `order_data` JSONB (my recommendation)
- **Option B:** Keep separate `breakdown` + `handling` JSONB (cleaner conceptually)
- **Option C:** Keep current design (has redundancies)

**What's your intuition?**

---

**Once you choose, I'll update the migration accordingly.**
