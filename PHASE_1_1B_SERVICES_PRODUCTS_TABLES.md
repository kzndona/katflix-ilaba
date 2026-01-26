# Phase 1.1B: Fresh Services & Products Tables Design

**Date:** January 26, 2026  
**Status:** Design Specification for Fresh Tables

---

## Overview

Creating fresh `services` and `products` tables to replace old schemas. These are optimized for the new POS system with proper fields and constraints.

### Issues with Current Design:

**Services Table Issues:**

- ❌ `rate_per_kg` pricing model (new guide uses flat per-basket rates)
- ❌ No `tier` column (basic vs premium not explicit)
- ❌ `fold` service exists but not in new guide
- ❌ No `image_url` for staff/customer reference
- ❌ No pricing for different tiers

**Products Table Issues:**

- ❌ Named `products` but schema calls it `inventory`
- ❌ No `image_url` (needed for POS display)
- ❌ No `category` (to group products)
- ❌ No `sku` for inventory management
- ❌ `unit` field unclear (units of what?)

---

## Fresh Services Table

```sql
-- ============================================================================
-- DROP OLD SERVICES (Fresh start)
-- ============================================================================

DROP TABLE IF EXISTS public.services CASCADE;

-- ============================================================================
-- CREATE NEW SERVICES TABLE
-- ============================================================================

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Service Identification
  service_type TEXT NOT NULL CHECK (service_type IN (
    'wash',
    'spin',
    'dry',
    'iron',
    'staff_service',
    'pickup',
    'delivery'
  )),

  -- Display
  name TEXT NOT NULL,                    -- "Wash Basic", "Wash Premium", "Dry Basic", etc
  description TEXT,                       -- Detailed description

  -- Pricing (per-basket for wash/dry/spin, per-kg for iron, per-order for staff_service)
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price > 0),  -- PHP per unit

  -- Tier (for wash, dry; null for others)
  tier TEXT CHECK (tier IN ('basic', 'premium')),

  -- Duration
  base_duration_minutes INTEGER CHECK (base_duration_minutes >= 0),  -- How long service takes

  -- Modifiers (admin-configurable adjustments/add-ons)
  modifiers JSONB,                        -- Flexible adjustments (e.g., additional dry time)

  -- Display/UI
  image_url TEXT,                         -- Service image/icon URL
  sort_order INTEGER DEFAULT 0,           -- For UI ordering

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT services_tier_check CHECK (
    -- Wash and Dry must have tier; others must not
    CASE
      WHEN service_type IN ('wash', 'dry') THEN tier IS NOT NULL
      WHEN service_type IN ('spin', 'iron', 'staff_service', 'pickup', 'delivery') THEN tier IS NULL
      ELSE FALSE
    END
  )
);

-- Indexes
CREATE INDEX idx_services_service_type ON public.services(service_type);
CREATE INDEX idx_services_tier ON public.services(tier);
CREATE INDEX idx_services_is_active ON public.services(is_active);
CREATE INDEX idx_services_sort_order ON public.services(sort_order);

-- ============================================================================
-- SERVICES DATA REFERENCE
-- ============================================================================

-- Insert default services (adjust prices/durations as needed):
--
-- INSERT INTO public.services (service_type, name, description, base_price, tier, base_duration_minutes, is_active, sort_order)
-- VALUES
--   ('wash', 'Wash Basic', 'Basic wash service', 65.00, 'basic', 39, true, 10),
--   ('wash', 'Wash Premium', 'Premium wash with extra care', 80.00, 'premium', 33, true, 20),
--   ('dry', 'Dry Basic', 'Basic drying service', 65.00, 'basic', 32, true, 30),
--   ('dry', 'Dry Premium', 'Premium drying with adjustments', 80.00, 'premium', 32, true, 40),
--   ('spin', 'Spin', 'Spin service', 20.00, NULL, 10, true, 50),
--   ('iron', 'Iron', 'Ironing service per kg (2-8kg)', 80.00, NULL, NULL, true, 60),
--   ('staff_service', 'Staff Service', 'Staff pickup/service charge', 40.00, NULL, NULL, true, 70),
--   ('pickup', 'Pickup', 'Customer pickup service', 0.00, NULL, NULL, false, 80),
--   ('delivery', 'Delivery', 'Customer delivery service (50 PHP minimum)', 50.00, NULL, NULL, true, 90);
--
-- Note: pickup is deprecated (now handled in delivery flow)
-- Note: staff_service is a fee, not a service users select
-- Note: delivery fee can be overridden per order

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_services_updated_at();
```

---

## Fresh Products Table

```sql
-- ============================================================================
-- DROP OLD PRODUCTS (Fresh start)
-- ============================================================================

DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;  -- If it exists

-- ============================================================================
-- CREATE NEW PRODUCTS TABLE
-- ============================================================================

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product Identification
  sku TEXT UNIQUE NOT NULL,                -- Stock Keeping Unit (e.g., "PLASTIC_BAG_001")
  item_name TEXT NOT NULL,                 -- Display name (e.g., "Plastic Bag")
  description TEXT,                        -- Product description

  -- Pricing (per unit)
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),   -- Sale price to customer
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),     -- Cost to business (for profit calc)
  unit TEXT NOT NULL DEFAULT 'piece',      -- Unit of measurement (piece, pack, bottle, etc)

  -- Inventory
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),

  -- Display/UI
  image_url TEXT,                          -- Product image URL (cached for bandwidth)
  image_cached_at TIMESTAMP,               -- When image was last cached
  sort_order INTEGER DEFAULT 0,            -- For UI ordering

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_stock_check TIMESTAMP,
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT products_price_check CHECK (unit_price >= unit_cost)  -- Can't sell below cost!
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_item_name ON public.products(item_name);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_quantity_low ON public.products(quantity)
  WHERE quantity <= reorder_level AND is_active = true;  -- Low stock alerts

-- ============================================================================
-- PRODUCTS DATA REFERENCE
-- ============================================================================

-- Insert default products (adjust as needed):
--
-- INSERT INTO public.products (sku, item_name, description, unit_price, unit_cost, unit, quantity, reorder_level, is_active, sort_order)
-- VALUES
--   ('PLASTIC_BAG_001', 'Plastic Bag', 'Standard single-use plastic bag', 3.00, 0.50, 'piece', 100, 20, true, 10),
--   ('TISSUE_001', 'Tissue Paper', 'Standard white tissue paper pack', 5.00, 1.50, 'pack', 50, 10, true, 20);
--
-- Note: Prices are inclusive of VAT (12%)

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_products_updated_at();
```

---

## Field-by-Field Explanation

### Services Table

| Field                   | Type      | Purpose                                               | Example                                                  |
| ----------------------- | --------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `id`                    | UUID      | Primary key                                           | `550e8400-e29b-41d4-a716-446655440000`                   |
| `service_type`          | TEXT      | Type of service                                       | `'wash'`, `'dry'`, `'spin'`, `'iron'`, `'staff_service'` |
| `name`                  | TEXT      | Display name                                          | `'Wash Basic'`, `'Iron'`                                 |
| `description`           | TEXT      | Longer description                                    | `'Premium wash with extra care'`                         |
| `base_price`            | NUMERIC   | PHP per basket (wash/dry/spin) or per kg (iron)       | `65.00`, `80.00`                                         |
| `tier`                  | TEXT      | `'basic'` or `'premium'` (wash/dry only)              | `'basic'`, `'premium'`                                   |
| `base_duration_minutes` | INTEGER   | How long service typically takes                      | `39`, `33`, `32`                                         |
| `modifiers`             | JSONB     | Admin-configurable adjustments (e.g., extra dry time) | See below                                                |
| `image_url`             | TEXT      | Icon/image for UI display                             | `'/images/services/wash.png'`                            |
| `sort_order`            | INTEGER   | Order in UI                                           | `10`, `20`, `30`                                         |
| `is_active`             | BOOLEAN   | Whether service is available                          | `true`, `false`                                          |
| `created_at`            | TIMESTAMP | When created                                          | `2026-01-26 10:30:00`                                    |
| `updated_at`            | TIMESTAMP | Last update (auto-managed)                            | `2026-01-26 11:45:00`                                    |
| `updated_by`            | UUID      | Who last updated                                      | Staff ID                                                 |

### Products Table

| Field              | Type      | Purpose                        | Example                                |
| ------------------ | --------- | ------------------------------ | -------------------------------------- |
| `id`               | UUID      | Primary key                    | `550e8400-e29b-41d4-a716-446655440000` |
| `sku`              | TEXT      | Stock keeping unit (unique)    | `'PLASTIC_BAG_001'`                    |
| `item_name`        | TEXT      | Display name                   | `'Plastic Bag'`                        |
| `description`      | TEXT      | Product details                | `'Durable plastic bags, 50 per pack'`  |
| `unit_price`       | NUMERIC   | Price customer pays (PHP)      | `3.00`, `5.00`                         |
| `unit_cost`        | NUMERIC   | What business paid (PHP)       | `0.50`, `1.50`                         |
| `unit`             | TEXT      | Unit of sale                   | `'piece'`, `'pack'`, `'bottle'`        |
| `quantity`         | NUMERIC   | Current stock                  | `100`, `50`                            |
| `reorder_level`    | NUMERIC   | Reorder when stock drops below | `20`, `10`                             |
| `image_url`        | TEXT      | Product image (cached)         | `'/images/products/plastic-bag.jpg'`   |
| `image_cached_at`  | TIMESTAMP | When image was cached          | `2026-01-26 10:30:00`                  |
| `sort_order`       | INTEGER   | Order in UI                    | `10`, `20`, `30`                       |
| `is_active`        | BOOLEAN   | Available for sale             | `true`, `false`                        |
| `created_at`       | TIMESTAMP | Created date                   | `2026-01-26 10:30:00`                  |
| `updated_at`       | TIMESTAMP | Last update (auto)             | `2026-01-26 11:45:00`                  |
| `last_stock_check` | TIMESTAMP | Last inventory verification    | `2026-01-26 09:00:00`                  |
| `updated_by`       | UUID      | Who last updated               | Staff ID                               |

---

## Key Design Decisions

### 1. ✅ Services: `base_price` instead of `rate_per_kg`

- New system uses flat per-basket pricing
- Iron is exception: per kg (2-8kg range)
- All priced in PHP

### 2. ✅ Services: Explicit `tier` for wash/dry

- Tier is NULL for other service types (enforced by constraint)
- Makes it clear which services have basic/premium options
- Easier to query and display

### 3. ✅ Services: Removed `fold` service

- Not in new POS guide
- Can add back later if needed

### 4. ✅ Products: Added `sku` (unique)

- Better inventory tracking
- Prevents duplicate products
- Standard practice

### 5. ✅ Products: `unit_cost` required

- Calculate profit margin
- Cost-based decisions
- Constraint: `unit_price >= unit_cost`

### 6. ✅ Products: `image_url` with caching

- Manage Supabase free tier bandwidth
- Track when cached (can refresh periodically)
- Serve from CDN/cache

### 7. ✅ Both: `sort_order` for UI ordering

- Control display sequence without renaming
- Numeric allows fine-grained control

### 8. ✅ Both: Auto `updated_at` via trigger

- Maintains data freshness tracking
- No manual updates needed

### 9. ✅ Both: `updated_by` UUID

- Audit trail (who changed what)
- Links to staff member

---

## Service Modifiers (Admin-Configurable)

The `modifiers` JSONB column allows staff/admins to configure service adjustments without code changes.

### Example 1: Additional Dry Time (Current)

For Dry services, staff can configure how much extra drying time costs:

```json
{
  "dry_time_adjustments": {
    "enabled": true,
    "name": "Additional Dry Time",
    "unit": "8 minutes",
    "price_per_unit": 15.0,
    "max_increments": 3,
    "max_total_minutes": 24,
    "description": "Add 8-minute drying increments"
  }
}
```

**How it's used in order_data:**

```json
"baskets": [{
  "basket_number": 1,
  "services": [{
    "id": "uuid",
    "service_name": "Dry Premium",
    "base_price": 80.00,
    "modifiers_applied": {
      "dry_time_adjustments": {
        "increments": 2,
        "total_minutes": 16,
        "fee": 30.00
      }
    },
    "subtotal": 110.00
  }]
}]
```

### Example 2: Future Use Case - Premium Detergent Add-on

Staff can add new modifiers by editing the service in UI:

```json
{
  "detergent_options": {
    "enabled": true,
    "name": "Premium Detergent",
    "type": "boolean",
    "price": 10.0,
    "description": "Use premium eco-friendly detergent"
  },
  "dry_time_adjustments": {
    "enabled": true,
    "name": "Additional Dry Time",
    "unit": "8 minutes",
    "price_per_unit": 15.0,
    "max_increments": 3
  }
}
```

---

## Implementation Notes

### UI Flow with Modifiers

**Step 2 - Services Selection:**

```
[ ] Wash Basic (65 PHP) - 39 min
[+] Add extra dry time? 8-min increments @ 15 PHP each
    [0] [+] [+] [+]  ← Radio buttons (0, 1, 2, 3 increments)

[+] Premium detergent? (+10 PHP)
    [ ] No  [x] Yes
```

### API/Backend

When creating order, system should:

1. Fetch service with `modifiers`
2. Validate modifier selections against config
3. Calculate modifier fees
4. Store in `order_data.baskets[].services[].modifiers_applied`

### Admin Interface

Staff can edit service modifiers in manage/services page:

```
Service: Dry Premium
...
Modifiers:
  ☑ Dry Time Adjustments
    Unit: 8 minutes
    Price per unit: 15.00 PHP
    Max increments: 3

  ☐ Premium Detergent
    [Add new modifier...]
```

---

## Services Constraints Explained

### Tier Constraint

```sql
CONSTRAINT services_tier_check CHECK (
  CASE
    WHEN service_type IN ('wash', 'dry') THEN tier IS NOT NULL
    WHEN service_type IN ('spin', 'iron', 'staff_service', 'pickup', 'delivery')
      THEN tier IS NULL
    ELSE FALSE
  END
)
```

**What this does:**

- ✅ Wash & Dry **MUST** have tier (basic or premium)
- ✅ Other services **MUST NOT** have tier
- ❌ Prevents: Spin service with `tier = 'basic'`
- ❌ Prevents: Wash service with `tier = NULL`

---

## Products Constraints Explained

### Price Constraint

```sql
CONSTRAINT products_price_check CHECK (unit_price >= unit_cost)
```

**What this does:**

- ✅ Selling price must be >= cost price
- ❌ Prevents: Selling plastic bag for 0.50 when cost is 1.00

### Quantity Constraint

```sql
quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0)
```

**What this does:**

- ✅ Stock can't be negative
- ❌ Prevents: Creating "phantom stock"

---

## Sample Data

### Services

```sql
INSERT INTO public.services (service_type, name, description, base_price, tier, base_duration_minutes, is_active, sort_order)
VALUES
  ('wash', 'Wash Basic', 'Basic wash with standard care', 65.00, 'basic', 39, true, 10),
  ('wash', 'Wash Premium', 'Premium wash with extra care', 80.00, 'premium', 33, true, 15),
  ('dry', 'Dry Basic', 'Basic drying service', 65.00, 'basic', 32, true, 20),
  ('dry', 'Dry Premium', 'Premium drying with gentle heat', 80.00, 'premium', 32, true, 25),
  ('spin', 'Spin', 'Spin service to remove excess water', 20.00, NULL, 10, true, 30),
  ('iron', 'Iron', 'Iron service (per kg, 2-8kg)', 80.00, NULL, NULL, true, 40),
  ('staff_service', 'Staff Service', 'Staff pickup/service charge', 40.00, NULL, NULL, true, 50),
  ('delivery', 'Delivery', 'Customer delivery (minimum 50 PHP)', 50.00, NULL, NULL, true, 60);
```

### Products

```sql
INSERT INTO public.products (sku, item_name, description, category, unit_price, unit_cost, unit, quantity, reorder_level, is_active, sort_order)
VALUES
  ('PLASTIC_BAG_001', 'Plastic Bag', 'Standard single-use plastic bag', 'bags', 3.00, 0.50, 'piece', 100, 20, true, 10),
  ('TISSUE_001', 'Tissue Paper', 'Standard white tissue paper pack', 'supplies', 5.00, 1.50, 'pack', 50, 10, true, 20);
```

---

## Next Steps

1. **Review this design** - Does the structure feel right?
2. **Approve it** - Ready to combine with orders table migration
3. **Execute** - All three tables (orders, services, products) together

---

## Notes

- **Fresh Start**: Both tables are created from scratch (old data will be lost)
- **No Connections Yet**: Foreign key relationships (orders → services/products) defined in API layer
- **Cascading Deletes**: Products/services can be soft-deleted via `is_active = false`
- **Auditing**: `updated_by` and timestamps provide full audit trail
- **Future**: Can add more categories, service types without schema changes

Ready to review and execute?
