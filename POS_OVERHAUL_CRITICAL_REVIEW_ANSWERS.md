**PLEASE PRIORITIZE THE GUIDE OVER EXISTING CODE. THIS IS AN OVERHAUL AFTERALL**

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

- ☝️ Services are priced per kg, but your guide shows flat prices (65.00, 80.00)
  - Now per basket (load)

- ☝️ You mention "drop-off service" (40 pesos) but it's not a valid service_type
  - It is the "service charge". The shop now offers self-service laundry or staff-service laundry. If staff-service laundry, we will charge 40 pesos, if not then don't charge service fee.

- ☝️ "Additional dry time" (+15 pesos, +8 minutes) - how does this work?
  - I think it would be simpler to make a separate service instance
  - Increments should be: 0, 8, 16, 24 minutes. Use '-'/'+' buttons

- ☝️ Premium tier determined by name string matching (fragile)
  - Suggestion: Add `tier` column to services: `tier TEXT CHECK(tier IN ('basic', 'premium'))`
  - I DONT GET THIS

---

### 2. 🔴 Plastic Bag & Iron Minimum Weight

**Your Guide Says:**

```
plastic bag = -/+ ({price: 3.00}) -- this is a product item
iron = -/+ ({price: 80.00/kg}) -- minimum of 2kg
```

**Problems:**

- ☝️ Plastic bag: Is this a product (from inventory) or a service add-on?
  - Product should be in products table, treated like any other item
  - Treat it as a product but show it in baskets

- ☝️ Iron minimum weight (2kg):
  - Iron minimum should be UI-validated
  - If cashier adds an iron, the minimum should be 2kg and never lower. Max 8kg (basket max weight)

- ☝️ Iron pricing minimum is 160 pesos

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

- ☝️ Drop-off is the same as the 40 PHP service fee
- ☝️ It is now optional. Customers can self-service or avail the drop-off service (served to completion by staff)
- ☝️ Should be a checkbox, toggle, or switch in baskets

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

- ☝️ If customer chooses delivery but then changes mind that's on them
- ☝️ Cashier should be able to override the default 50, no lower than 50
- ☝️ Delivery fee should appear in breakdown.fees with reason
- ☝️ If customer picks up some baskets, delivers others that's where the override comes in

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
☝️ Let's keep/add order-level and handling notes only

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

☝️ This will be added in order management not in POS

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

- ☝️ If customer wants "no wash", Just toggle to off?
- ☝️ If customer wants multiple wash cycles (basic has already 2 cycles and premium has 3), then it's new basket
- ☝️ Wash is truly optional

**Suggested UI:**

```
Wash: [Off] [Basic] [Premium]  // Mutually exclusive radio ☝️ I like this approach
Wash Count: [1] [2] [3]        // How many cycles? ☝️ Not mutiplier. If basic, use the basic fee regardless if 1 or 2 wash (default to 2) and 3 is disabled. If premium, disable all radio buttons and select 3
```

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

- ☝️ New code treats iron weight-based service (minimum of 2kg, max of 8kg, increments of 1kg)
- ☝️ How does cashier input iron weight? '-' & '+' buttons
- ☝️ Iron weight is not same as basket weight other than ceiling. Valid iron weights: 0 (off), 2, 3, 4, 5, 6, 7, 8kg

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

☝️ there's no premium iron

---

### 5. Dry Time Adjustments

**Your Guide:**

```
additional dry time = -/+ ({price: 15}, {duration: 8 min})
```

**Problem:**

- ☝️ "-/+" means add OR remove dry time
- ☝️ This is total dry
- ☝️ Customer cannot order "-2 extra times"

**Current Code:**

```typescript
dryCount: number; // 0, 1, 2, etc.
dryPremium: boolean;
```

**Suggested:**

- Explicit: `additionalDryTimeMinutes: -8, 0, +8, +16`?

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

- Should order be created BEFORE inventory deduction? (More atomic) ☝️ Your call
- What if customer update fails? Rollback everything? ☝️ I suppose yes
- Should this be a database transaction or API-level? ☝️ If database can treat it as one job of multiple task where if one task fail the job fails then database

---

### 2. Loyalty Discount - When Applied?

**Missing Details:**

- Is discount shown before or after confirming payment?
  ☝️ Compute gross total > show option for discount > apply discount if told by customer and show final total > payments
- Should it be shown earlier (in receipt summary)?
  ☝️ subtotal (computation of everything including other fees) > discount > final total
- Should checkout be blocked if loyalty discount would exceed total? > nah

**ACTION REQUIRED:**
Confirm when loyalty discount should be visible/applied

---

### 3. Missing Fields in Breakdown

**Your Guide Doesn't Mention:**

- Delivery fee placement (in breakdown.fees? Or separate?)
  ☝️ Propose a new approach
- Service fee (40 PHP) - should this be conditional or automatic?
  ☝️ Now conditional depending on whether order is self-service or full-service
- VAT handling - guide doesn't mention tax at all
  - Current code: 12% VAT INCLUSIVE
  - Should this be configurable?
    ☝️ NO

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

- Can cashier go back to edit baskets after moving to products? (Current design: yes) ☝️ yes
- Should there be a "review" step before final payment? ☝️ sure
- Should customer info be validated before moving forward? ☝️ yes

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

- ☝️ Product images not displayed in PaneProducts
- ☝️ Stock quantity not shown (only loaded from DB, not displayed)
- ☝️ No low-stock warnings or indicators

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

- ☝️ No validation for 8kg limit
- ☝️ No auto-creation of new basket
- ☝️ UI allows entering any weight

**Should This Be:**

- Hard limit. Cashier no longer enters basket weight. Baskets are literally 8kgs now.

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
- ☝️ This could exceed free tier quickly

**ACTION REQUIRED:**

1. Implement debouncing (e.g., 500ms delay)
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
    ☝️ Your call, IDK how real POSs handle this
- What if customer underpays?
  - Current code blocks checkout
  - Should allow "layaway" or "hold order"?
    ☝️ Block
- What about partial payments? (Cash + GCash?)
  ☝️ Not supported

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
