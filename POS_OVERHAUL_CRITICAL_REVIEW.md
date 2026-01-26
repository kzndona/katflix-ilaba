# POS Overhaul Guide - Critical Review

**Date:** January 26, 2026  
**Status:** Pre-Implementation Analysis

---

## Overall Assessment

✅ **The workflow makes sense** - Clear, logical progression from laundry → products → customer → delivery → payment.

⚠️ **BUT - Multiple critical gaps between your guide and database schema that will cause issues if not addressed first.**

---

## Critical Issues (Must Fix Before Building)

### 1. 🔴 Service Definition Mismatch

**Your Guide Says:**

```
wash = on/off
  premium = {price: 65.00, duration: 33 min}
  basic = {price: 80.00, duration: 39 min}
```

**Database Reality:**

```sql
CREATE TABLE services (
  id UUID,
  service_type TEXT,  -- 'wash', 'dry', 'spin', 'iron', 'fold', 'pickup', 'delivery'
  name TEXT,          -- "Premium Wash" or "Basic Wash"
  rate_per_kg NUMERIC,
  base_duration_minutes NUMERIC
)
```

**Problems:**

- ❌ Services are priced per kg, but your guide shows flat prices (65.00, 80.00)
  - Is that per kg or per load?
  - If per kg, a 10kg load at 65/kg = 650 pesos?
  - Current code multiplies: `price_per_kg * weight * multiplier`

- ❌ You mention "drop-off service" (40 pesos) but it's not a valid service_type
  - Valid types: pickup, wash, spin, dry, iron, fold, delivery
  - Is "drop-off" the same as "pickup"? Or a separate service?

- ❌ "Additional dry time" (+15 pesos, +8 minutes) - how does this work?
  - Is it a separate service instance?
  - Can customer add multiple increments? (-2x, -1x, +1x, +2x)?
  - Should this be a dropdown or input field?

- ❌ Premium tier determined by name string matching (fragile)
  - Suggestion: Add `tier` column to services: `tier TEXT CHECK(tier IN ('basic', 'premium'))`

**ACTION REQUIRED:**
Define exact pricing model before building UI:

1. Are prices per kg or flat per load/service?
2. What counts as a "service"? (Drop-off separate? Additional dry time separate?)
3. Create service variant/tier structure in database

---

### 2. 🔴 Plastic Bag & Iron Minimum Weight

**Your Guide Says:**

```
plastic bag = -/+ ({price: 3.00}) -- this is a product item
iron = -/+ ({price: 80.00/kg}) -- minimum of 2kg
```

**Problems:**

- ❌ Plastic bag: Is this a product (from inventory) or a service add-on?
  - If product: Should be in products table, treated like any other item
  - If service: Should be in services table
  - Currently: You're treating it as product but pricing it as service

- ❌ Iron minimum weight (2kg):
  - How is this validated? UI-side only or database?
  - What if customer orders 1.5kg iron? Error? Auto-adjust to 2kg?
  - Current UI doesn't enforce minimums

- ❌ Iron pricing per kg: Is the minimum 2kg × 80/kg = 160 pesos? Or just 80 pesos?

**ACTION REQUIRED:**
Clarify:

1. Plastic bag: product or service? If product, add to products table
2. Iron minimum: how to handle? Auto-round to 2kg? Or reject order?
3. Iron pricing: flat 160 (2kg minimum) or variable?

---

### 3. 🔴 Service Fee (Drop-off?)

**Current Code:**

```typescript
const serviceFee = hasServiceBaskets ? 40 : 0; // PHP40 if baskets exist
```

**Your Guide:**

```
drop-off service = on/off ({price: 40.00})
```

**Problem:**

- ❌ Is drop-off the same as the 40 PHP service fee?
- ❌ Or should drop-off be optional (customers can choose to use it)?
- ❌ If optional, should it be a checkbox in handling step?
- ❌ Current code auto-charges 40 if any basket exists - no user choice

**ACTION REQUIRED:**
Decide:

1. Is service fee (40 PHP) automatic or optional?
2. Should "drop-off service" be its own line item in pricing?
3. Should this appear in handling step or somewhere else?

---

### 4. 🔴 Delivery Fee Logic

**Your Guide:**

```
Step 5: "Add a delivery fee field which has a default value of 50.00"
```

**Current Code:**

```typescript
deliveryFee: 50,  // Default
// Only charged if handling.deliver === true
```

**Problem:**

- ❌ What if customer chooses delivery but then changes mind?
- ❌ Should cashier be able to override the default 50?
- ❌ Should delivery fee appear in breakdown.fees with reason?
- ❌ What if customer picks up some baskets, delivers others? (Can't with current architecture)

**Current Limitation:**

- All baskets in one order = same handling (all pickup OR all delivery)
- Can't split: "Basket 1 pickup, Basket 2 delivery"
- Is this acceptable?

**ACTION REQUIRED:**

1. Can delivery fee be overridden by cashier?
2. Do you need mixed pickup/delivery per basket?
3. Should delivery fee be charged per basket or per order?

---

## Major Gaps (Should Add)

### 1. Special Instructions / Notes

**Missing:**

- Laundry notes per basket ("Use cold water only", "Fragile items", "Separate colors")
- Order-level notes ("Call before delivery", "Leave at door")

**Suggested:**

```
Basket:
  notes: string  -- Already in schema ✓

Order/Handling:
  special_instructions: string  -- Add to handling JSONB
```

**ACTION REQUIRED:**
Add `special_instructions` field to handling JSONB

---

### 2. Machine Assignment

**Missing:**

- Cashier/attendant doesn't see which basket goes to which machine
- `breakdown.baskets` doesn't include `machine_id`
- Attendant can't track "I'm using machine #3 for this basket"

**Current DB:**

- `machines` table exists
- Services linked to service_type (wash, dry, iron)
- But no basket → machine mapping

**Suggestion:**

```typescript
// In breakdown.baskets:
{
  basket_number: 1,
  weight: 8,
  assigned_machine_id: "uuid" | null,  // Add this
  services: [...]
}
```

**ACTION REQUIRED:**
Decide if machine assignment should be:

- Automatic (system assigns based on availability)
- Manual (attendant picks machine)
- Not tracked at all (current state)

---

### 3. Wash Type vs Service Selection

**Your Guide Says:**

```
wash = on/off
wash type = premium OR basic
```

**Current Code:**
Does this via `washPremium: boolean` flag

**Problem:**

- ❌ What if customer wants "no wash"? Just toggle to off?
- ❌ What if customer wants multiple wash cycles? Can't select multiplier
- ❌ Wash is mandatory if basket exists? Or truly optional?

**Suggested UI:**

```
Wash: [Off] [Basic] [Premium]  // Mutually exclusive radio
Wash Count: [1] [2] [3]        // How many cycles? (currently: multiplier)
```

**ACTION REQUIRED:**
Clarify:

1. Can cashier completely skip wash? (Just dry + spin?)
2. Can customer want multiple wash cycles? (2x basic wash?)
3. Current "multiplier" field - what does it represent?

---

### 4. Iron Weight Input

**Current Code:**

```typescript
iron: boolean; // Just on/off
fold: boolean; // Just on/off
```

**Your Guide:**

```
iron = -/+ ({price: 80.00/kg}, {minimum of 2kg})
```

**Problem:**

- ❌ Current code treats iron as yes/no, not as weight-based service
- ❌ How does cashier input iron weight? Separate field?
- ❌ How does this relate to basket weight? Is iron weight same as basket weight?

**Suggested:**

```typescript
basket: {
  weightKg: 8,
  iron: {
    enabled: boolean
    weightKg: number  // Separate from laundry weight
    type: 'basic' | 'premium'  // Or just basic?
  }
}
```

**ACTION REQUIRED:**

1. Is iron weight separate from basket weight?
2. Can iron be done on subset of laundry? (8kg laundry, 3kg ironed)
3. How to handle minimum 2kg requirement?

---

### 5. Dry Time Adjustments

**Your Guide:**

```
additional dry time = -/+ ({price: 15}, {duration: 8 min})
```

**Problem:**

- ❌ What does "-/+" mean? (Can add OR remove dry time?)
- ❌ Is this per dry cycle or total dry?
- ❌ Can customer order "-2 extra times" or just "+1, +2, +3"?
- ❌ Current code doesn't support this at all

**Current Code:**

```typescript
dryCount: number; // 0, 1, 2, etc.
dryPremium: boolean;
```

**Suggested:**

- Change to numeric multiplier with adjustment: `dryMultiplier: 1` (normal), `2` (extra), `0.5` (less)?
- Or explicit: `additionalDryTimeMinutes: -8, 0, +8, +16`?

**ACTION REQUIRED:**

1. How should additional dry time work exactly?
2. Can it be negative (less dry time)?
3. Pricing per adjustment level?

---

## Data Flow Questions

### 1. Transaction Order (You Proposed)

```
1. Create/update customer
2. Update inventory
3. Create other rows
4. Create order row
5. Create other rows
```

**Issues:**

- ⚠️ Step 3 & 5: "other rows" - what exactly?
  - Product transactions? (Already handled by inventory deduction)
  - Service records? (No, they're in JSONB breakdown)
  - What needs to happen after order creation that can't happen before?

**Better Sequence:**

```
1. Validate: customer exists, products in stock, services active
2. Create/update customer
3. Create order
4. Create product_transactions (inventory deduction)
5. (Optionally) create payment_records, issue_tracking, etc.
```

**Questions:**

- Should order be created BEFORE inventory deduction? (More atomic)
- What if customer update fails? Rollback everything?
- Should this be a database transaction or API-level?

---

### 2. Loyalty Discount - When Applied?

**Missing Details:**

- Is discount shown before or after confirming payment?
- Current code: shows in final confirmation modal
- Should it be shown earlier (in receipt summary)?
- Should checkout be blocked if loyalty discount would exceed total?

**ACTION REQUIRED:**
Confirm when loyalty discount should be visible/applied

---

### 3. Missing Fields in Breakdown

**Your Guide Doesn't Mention:**

- Delivery fee placement (in breakdown.fees? Or separate?)
- Service fee (40 PHP) - should this be conditional or automatic?
- VAT handling - guide doesn't mention tax at all
  - Current code: 12% VAT INCLUSIVE
  - Should this be configurable?

**Current Breakdown Structure:**

```typescript
{
  items: OrderItem[]              // Products ✓
  baskets: OrderBasket[]          // Services ✓
  fees: OrderFee[]                // Service + delivery fees
  payment: OrderPayment           // ✓
  summary: OrderSummary           // Subtotals + VAT ✓
  audit_log: AuditLogEntry[]      // ✓
  discounts: OrderDiscount[]      // Loyalty discount?
}
```

**ACTION REQUIRED:**
Where should these fit?

- Drop-off fee: In fees[] with type:'drop_off_fee'?
- Delivery fee: In fees[] with type:'delivery_fee'?
- Loyalty discount: In discounts[]?

---

## Missing UI/UX Considerations

### 1. Step Validation

**Your Guide Says:**

```
Step 1-2: Baskets
Step 3: Products
Step 4: Customer
Step 5: Delivery
Step 6: Payment
```

**Questions:**

- Can cashier go back to edit baskets after moving to products? (Current design: yes)
- Should there be a "review" step before final payment?
- Should customer info be validated before moving forward?

**Current UX Issue:**

- Panes are linear but don't prevent going back
- No visual progress indicator
- User might not know what's required vs optional

---

### 2. Product Selection UI

**Your Guide Says:**

```
"Cashier will see product image, price, and remaining quantity"
```

**Missing from Current Code:**

- ❌ Product images not displayed in PaneProducts
- ❌ Stock quantity not shown (only loaded from DB, not displayed)
- ❌ No low-stock warnings or indicators

**Database Has:**

- ✓ image_url field
- ✓ quantity field

**ACTION REQUIRED:**

1. Display product images (may slow UI if Supabase free tier)
2. Show stock quantities
3. Show reorder level indicator (red if low)
4. Prevent ordering more than in stock (current code allows it if stock exists)

---

### 3. Basket Weight Limit (8kg)

**Your Guide Says:**

```
"Basket (load) = 8 kg (if > 8, new basket)"
```

**Current Code:**

- ❌ No validation for 8kg limit
- ❌ No auto-creation of new basket
- ❌ UI allows entering any weight

**Should This Be:**

- Hard limit: can't enter > 8kg? (Error message)
- Soft warning: "Exceeds recommended 8kg"?
- Auto-split: "Create new basket for remaining weight"?

**ACTION REQUIRED:**
Decide on enforcement:

1. Hard limit (prevent save)
2. Warning (allow but warn)
3. Auto-split (create new basket)

---

### 4. Customer Selection Flow

**Your Guide Says:**

```
Step 4: "They will search the name if a record exists, else enter details"
```

**Current Implementation:**

- ✓ Real-time search (no debouncing - will be expensive on Supabase free tier)
- ✓ Can create new customer inline
- ⚠️ Auto-clears after 3 seconds if not selected (UX issue)

**Supabase Free Tier Concern:**

- 50,000 requests/month limit
- Real-time search = 1 request per keystroke
- 20 chars in name = 20 requests per customer search
- ❌ This could exceed free tier quickly

**ACTION REQUIRED:**

1. Implement debouncing (e.g., 300ms delay)
2. Require minimum 2-3 characters before searching
3. Consider pagination (show 10 results, not all)

---

### 5. Payment Modal

**Your Guide Says:**

```
"Cashier selects MOP, enters received amount, shows change if cash"
```

**Current Implementation:**

- ✓ Cash payment with change calculation
- ✓ GCash with reference number
- ⚠️ Amount validation (must match total for cash or paid >= total)

**Missing Edge Cases:**

- What if customer wants to give excess cash? (e.g., 1000 for 999.50)
  - Current code requires: `amountPaid >= total`
  - Change calculated correctly
- What if customer underpays?
  - Current code blocks checkout
  - Should allow "layaway" or "hold order"?
- What about partial payments? (Cash + GCash?)

**ACTION REQUIRED:**

1. Support underpayment? (Hold order, balance due later)
2. Support overpayment? (Treat as deposit for next order?)
3. Support split payment? (Not currently possible)

---

## Supabase Free Tier Constraints

### Rate Limits

- ✅ 50,000 API calls/month (should be OK for POS)
- ⚠️ Real-time search could exceed this
- ⚠️ Image loading from DB could be slow

### Recommendations

1. **Debounce customer search** (300-500ms)
2. **Lazy-load product images** (not on initial load)
3. **Cache services & products** (load once, refresh hourly)
4. **Batch analytics queries** (don't real-time update dashboard)

---

## Questions Requiring Clarification

### Business Logic

1. **Service Fee (40 PHP)**: Automatic or optional? Only if baskets?
2. **Drop-off Service**: Is this the same as service fee or different?
3. **Iron**: Separate weight input? Minimum 2kg hard limit or warning?
4. **Additional Dry Time**: How many levels (-2x, -1x, +1x, +2x)? Pricing per level?
5. **Plastic Bag**: Product or service add-on?
6. **Delivery Fee**: Fixed 50 or can cashier override?
7. **Mixed Handling**: Can same order have some baskets for pickup, others for delivery?
8. **Underpayment**: Support "hold order" or require full payment?
9. **Service Pricing**: Per kg or flat? (Current code assumes per kg)

### Database Design

1. Should services have a `tier` column instead of string matching?
2. Should `breakdown.baskets` include `assigned_machine_id`?
3. Should handling JSONB include `special_instructions`?
4. Should there be `order_drafts` table for incomplete orders?

### UI/UX

1. Should product images be displayed? (Performance concern)
2. Should 8kg limit be hard, soft, or auto-split?
3. Should there be a "review" step before payment?
4. Should customer search be debounced?
5. Should loyalty discount be shown earlier than payment confirmation?

---

## Summary: What Works, What Doesn't

### ✅ Good Parts of Your Guide

- Clear sequential workflow
- Customer info comes late (practical)
- Right-side summary panel (matches current design)
- Transaction-based save (correct approach)
- Separation of baskets → products → customer → delivery → payment

### ⚠️ Needs Clarification

- Service pricing model (per kg vs flat)
- Service variants structure (drop-off, additional dry time, iron)
- Weight limits (8kg rule)
- Delivery fee logic
- Special instructions & notes

### ❌ Missing Entirely

- Machine assignment tracking
- Draft order support
- Underpayment/layaway support
- Special instructions field
- Service tier/variant database structure

---

## Recommended Next Steps

1. **Answer the 18 questions above** - This clarifies business logic
2. **Update database schema** - Add missing fields/tables
3. **Update service structure** - Add tier/variant support
4. **Design new breakdown structure** - Account for all fees/discounts
5. **Then: Build the UI** - Based on clarified requirements

---

**This review is complete. Please address the questions before we start building.**
