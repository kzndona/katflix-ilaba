# Phase 1.1: Database Schema Migration

**Date:** January 26, 2026  
**Status:** Ready for Execution (Option A - Unified order_data JSONB)

---

## Overview

This migration updates the database schema to support the new POS system following the overhaul guide. **Option A** uses a unified `order_data` JSONB column containing everything about the order in a single, consistent structure.

### Key Changes:

1. Add `tier` column to `services` table (basic/premium)
2. Simplify `orders` table with unified `order_data` JSONB
3. Remove redundant columns (`breakdown`, `handling`, `is_staff_service`, `order_note`)
4. Add `total_amount` for analytics/reporting
5. Add comprehensive GIN indexes

---

## Fresh Orders Table Design

### Current Orders Table (Old)

```
orders:
  id UUID
  customer_id UUID
  cashier_id UUID
  source TEXT
  status TEXT
  breakdown JSONB       ← Pricing data
  handling JSONB        ← Logistics data
  is_staff_service BOOLEAN  ← Redundant
  order_note TEXT       ← Unclear purpose
```

### New Orders Table (Fresh)

```
orders:
  id UUID PRIMARY KEY
  customer_id UUID FK
  cashier_id UUID FK
  source TEXT
  status TEXT
  total_amount NUMERIC(10,2)  -- Denormalized for analytics
  created_at TIMESTAMP
  updated_at TIMESTAMP
  cancelled_at TIMESTAMP
  order_data JSONB      -- Everything unified here
  cancellation JSONB    -- Only if cancelled
```

---

## Migration SQL

```sql
-- ============================================================================
-- STEP 1: ADD TIER COLUMN TO SERVICES
-- ============================================================================

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS tier TEXT
CHECK (tier IN ('basic', 'premium'))
DEFAULT NULL;

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_services_tier
ON public.services(tier);

-- ============================================================================
-- STEP 2: ADD MODIFIERS TO SERVICES (admin-configurable)
-- ============================================================================

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS modifiers JSONB,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================================
-- STEP 3: DROP OLD ORDERS TABLE (Fresh Start)
-- ============================================================================

-- IMPORTANT: This will delete ALL existing order data
-- Archive old data if needed before running this migration

DROP TABLE IF EXISTS public.orders CASCADE;

-- ============================================================================
-- STEP 4: CREATE NEW FRESH ORDERS TABLE
-- ============================================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,

  -- Order Metadata
  source TEXT NOT NULL DEFAULT 'store' CHECK (source IN ('store', 'app')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),

  -- Denormalized for Performance
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMP,

  -- Complete Order Data (Everything unified here)
  order_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Only populated if status = 'cancelled'
  cancellation JSONB
);

-- ============================================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Main GIN index for all JSONB queries
CREATE INDEX idx_orders_data_gin
ON public.orders USING GIN (order_data);

-- Specific indexes for common queries
CREATE INDEX idx_orders_payment_method
ON public.orders USING GIN ((order_data->'payment'));

CREATE INDEX idx_orders_self_service
ON public.orders USING GIN ((order_data->'handling'));

-- Lookup and sorting indexes
CREATE INDEX idx_orders_created_at
ON public.orders(created_at DESC);

CREATE INDEX idx_orders_updated_at
ON public.orders(updated_at DESC);

CREATE INDEX idx_orders_customer_id
ON public.orders(customer_id);

CREATE INDEX idx_orders_cashier_id
ON public.orders(cashier_id);

CREATE INDEX idx_orders_status
ON public.orders(status);

CREATE INDEX idx_orders_total_amount
ON public.orders(total_amount DESC);

-- ============================================================================
-- STEP 6: ADD TRIGGER FOR UPDATED_AT TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;

CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();

-- ============================================================================
-- SERVICES PRICING REFERENCE (for new orders)
-- ============================================================================

-- Wash Basic: 65 PHP per basket
-- Wash Premium: 80 PHP per basket
-- Dry Basic: 65 PHP per basket
-- Dry Premium: 80 PHP per basket
-- Spin: 20 PHP per basket
-- Iron: 80 PHP per kg (2-8kg)
-- Staff Service Charge: 40 PHP per order (optional)
-- Delivery Fee: 50 PHP default (overrideable, min 50 PHP)
-- Plastic Bag: 3 PHP each (product, not service)
-- VAT: 12% (inclusive, not additive)

-- ============================================================================
-- FRESH ORDERS TABLE READY
-- ============================================================================

-- All old data has been deleted
-- New table is clean and optimized
-- Ready for new POS system
```

---

## Order Data JSONB Structure

Everything about an order is stored in a single `order_data` JSONB column:

```json
{
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "product_name": "Plastic Bag",
      "quantity": 2,
      "unit_price": 3.0,
      "unit_cost": 0.0,
      "subtotal": 6.0
    }
  ],
  "baskets": [
    {
      "basket_number": 1,
      "weight": 8,
      "basket_notes": null,
      "services": [
        {
          "id": "uuid",
          "service_id": "uuid",
          "service_name": "Wash Basic",
          "service_type": "wash",
          "tier": "basic",
          "rate_per_unit": 65.0,
          "unit": "basket",
          "subtotal": 65.0,
          "status": "pending",
          "started_at": null,
          "completed_at": null,
          "completed_by": null,
          "duration_in_minutes": 39
        },
        {
          "id": "uuid",
          "service_id": "uuid",
          "service_name": "Dry Premium",
          "service_type": "dry",
          "tier": "premium",
          "rate_per_unit": 80.0,
          "unit": "basket",
          "subtotal": 80.0,
          "status": "pending",
          "duration_in_minutes": 32
        }
      ],
      "total": 145.0,
      "status": "pending"
    }
  ],
  "fees": [
    {
      "id": "uuid",
      "type": "service_charge",
      "description": "Staff Service Charge",
      "amount": 40.0
    },
    {
      "id": "uuid",
      "type": "delivery_fee",
      "description": "Delivery Fee",
      "amount": 50.0
    }
  ],
  "discounts": [
    {
      "id": "uuid",
      "type": "loyalty_discount",
      "description": "Loyalty Discount",
      "amount": 0.0,
      "percentage": 0,
      "points_used": 0
    }
  ],
  "payment": {
    "method": "cash",
    "amount_paid": 300.0,
    "change": 5.0,
    "payment_status": "successful",
    "completed_at": "2026-01-26T10:30:00Z"
  },
  "summary": {
    "subtotal_products": 6.0,
    "subtotal_services": 145.0,
    "subtotal_before_fees": 151.0,
    "service_charge": 40.0,
    "delivery_fee": 50.0,
    "subtotal_before_discount": 241.0,
    "vat_rate": 0.12,
    "vat_amount": 27.0,
    "grand_total_before_discount": 241.0,
    "loyalty_discount_amount": 0.0,
    "grand_total": 241.0
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
      "address": "123 Main St, City, State 12345",
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
    },
    {
      "action": "payment_completed",
      "timestamp": "2026-01-26T10:30:00Z",
      "changed_by": "staff-uuid"
    }
  ]
}
```

---

## Cancellation JSONB Structure

Only populated if `status = 'cancelled'`:

```json
{
  "reason": "Customer requested cancellation",
  "cancelled_at": "2026-01-26T11:00:00Z",
  "cancelled_by": "staff-uuid",
  "refund": {
    "method": "cash",
    "amount": 241.0,
    "status": "completed",
    "completed_at": "2026-01-26T11:00:00Z"
  },
  "inventory_restored": true,
  "notes": "Customer changed mind"
}
```

---

## Summary of Changes

| Item                  | Old Design                                             | New Design                                                     | Benefit                |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ---------------------- |
| Order data structure  | Split: `breakdown` + `handling`                        | Unified: `order_data`                                          | Single source of truth |
| Self-service tracking | `is_staff_service` column + `handling.is_self_service` | Only in `order_data.handling.is_self_service`                  | No redundancy          |
| Special instructions  | `breakdown.special_instructions`                       | Split: `order_data.special_instructions.laundry` + `.delivery` | Clear intent           |
| Order notes           | `order_note` column                                    | `order_data.handling.special_instructions.delivery`            | Consolidated           |
| Analytics             | No denorm                                              | `total_amount` column                                          | Fast querying          |
| Cancellation          | Mixed in order_data                                    | Separate `cancellation` JSONB                                  | Clean separation       |

---

## Validation Rules

### Service Creation/Update

- **Wash & Dry**: Must have `tier` = 'basic' or 'premium'
- **Spin, Iron**: `tier` = NULL
- **All services**: `rate_per_unit` > 0

### Order Data Structure

- **Items**: All products with quantity, unit_price, subtotal
- **Baskets**: Fixed 8kg, services array with status tracking
- **Payment**: method ('cash'|'gcash'), amount_paid, change, payment_status
- **Summary**: All calculated fields (subtotals, VAT, discounts, grand_total)
- **Special Instructions**: Separated into laundry vs delivery
- **Handling**: Pickup/delivery addresses, fee override, self-service flag
- **Audit Log**: All changes timestamped with actor

### VAT Calculation (Inclusive)

```
vat_amount = grand_total_before_discount × (vat_rate / (1 + vat_rate))
vat_amount = grand_total_before_discount × (0.12 / 1.12)
```

NOT: `subtotal × 0.12` and then add to total

---

## Querying Examples

### Get an order with all data

```sql
SELECT
  id,
  customer_id,
  status,
  total_amount,
  created_at,
  order_data,
  cancellation
FROM orders
WHERE id = '...'
LIMIT 1;
```

### Get self-service orders

```sql
SELECT id, order_data, created_at
FROM orders
WHERE order_data->'handling'->>'is_self_service' = 'true'
ORDER BY created_at DESC;
```

### Get orders by payment method

```sql
SELECT id, order_data->'payment'->>'method' as method, total_amount
FROM orders
WHERE order_data->'payment'->>'method' = 'cash';
```

### Get orders with delivery fee override

```sql
SELECT id, order_data->'handling'->>'delivery_fee_override' as override
FROM orders
WHERE order_data->'handling'->>'delivery_fee_override' IS NOT NULL;
```

---

## Notes

- **Backward Compatibility**: Migration keeps old columns initially. Once confirmed working, you can optionally drop them.
- **Data Integrity**: All order data is atomic - one JSONB object succeeds or fails together.
- **Denormalization**: `total_amount` is denormalized from `order_data.summary.grand_total` for performance (analytics, sorting).
- **Future-Proof**: New order metadata can be added to `order_data` without schema changes.

---

## Next Steps

1. **Execute this migration** on your Supabase
2. **Review the result** - Check that orders table structure looks good
3. **Verify data** (if migrating) - Spot-check a few order records
4. **Move to Phase 1.2** - API Specification Document

---

**Ready to run this migration?**
