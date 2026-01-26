# Second Pass: Implementation-Ready Questions

**Date:** January 26, 2026  
**Based on:** Your clarifications in POS_OVERHAUL_CRITICAL_REVIEW_ANSWERS.md

---

## What's NOW Clear ✅

1. **Per-basket pricing** (not per kg) - 65/80 PHP flat fee per basket
2. **Fixed 8kg baskets** - no weight entry, auto-create new baskets if needed
3. **Service charge conditional** - self-service OR staff-service (40 PHP)
4. **Wash cycles locked** - Basic (2 cycles default, 3 disabled) / Premium (3 cycles only)
5. **Iron weight input** - 2kg minimum, 8kg maximum, +/- buttons
6. **Delivery fee override** - Cashier can override but minimum 50 PHP
7. **Dry time adjustments** - Increments: 0, 8, 16, 24 minutes (separate service instance)
8. **Database transaction** - All-or-nothing at database level
9. **Debounced search** - 500ms delay, min 2-3 characters
10. **Loyalty discount** - Show after subtotal, before payment
11. **Special instructions** - Order/handling level only (not per-basket)

---

## Remaining Ambiguities - Need Clarification

### 1. Self-Service vs Staff-Service Selection

**Question:** How does cashier select self-service vs staff-service?

- Per basket (Basket 1 = self-service, Basket 2 = staff-service)?
- Per entire order (all baskets self-service OR all staff-service)?
  Good question! It should be per entire order and now I don't know where it should be placed in the UI
- Default to staff-service, optional checkbox to switch to self-service?
  Default to self-service (no service charge)

**Impact:** Affects where UI control goes and how service fee is calculated

---

### 2. Drop-off Service Checkbox Location

**Question:** Where does the drop-off/service charge toggle appear?

- In basket configuration section (next to wash/dry/spin/iron options)?
- In handling section (alongside delivery address)?
- In summary/review before payment?
- I think, before the baskets, there should be a self-service or staff-service UI

**Current UI Plan:**

- Baskets section: weight (auto 8kg) + wash + dry + spin + iron + fold + plastic bag + [SERVICE CHARGE toggle?]
- Products section: product selection
- Customer section: name/phone/email
- Handling section: pickup/delivery + address + delivery fee
- Review section: summary before payment
- Payment section: MOP selection

**Impact:** Changes layout of basket configuration pane

---

### 3. Plastic Bag Placement in Baskets

**Question:** You said "treat it as a product but show it in baskets" - where exactly?

- As a line item below the basket (under services)?
- As a separate section in basket ("Extras" or "Add-ons")? Yes. In-line with iron UI
- Quantity selector with +/- buttons? Yes

**Example:**

```
Basket 1 (8kg)
├─ Wash: Basic (80 PHP)
├─ Dry: Premium (65 PHP)
├─ Spin: Yes (20 PHP)
├─ Iron: No
├─ Fold: No
└─ Plastic Bags: [−] 1 [+] (3 PHP each = 3 PHP)  ← Here?
```

**Impact:** Affects basket component layout

---

### 4. Dry Time Additional Increments - Multiple or Single?

**Question:** Can customer select multiple dry time adjustments, or only one?

Example A (Single):

```
Additional Dry: [−8 min] [0 min] [+8 min] [+16 min] [+24 min] ← Radio buttons | THIS
```

Example B (Multiple):

```
Additional Dry Time: [+] [+] [+] [+] [+]  ← Add up to 5 increments of 8 min each
```

**Current assumption:** Single selection (Example A)

**Impact:** Changes dry time calculation logic

---

### 5. Iron Service Definition

**Question:** Is there only ONE iron service, or are there variants?

Option A - Single iron service: | THIS

```
Iron: Off / 2kg / 3kg / 4kg / 5kg / 6kg / 7kg / 8kg | BUT USE '-' '+' button to decrease/increase weight
Price: 80 pesos/kg
Example: 3kg iron = 3 × 80 = 240 PHP
```

Option B - Iron service + weight multiplier:

```
Iron: Off / On
Weight: [−] 2kg [+] to [−] 8kg [+]
Price: 2kg × 80 = 160 PHP minimum
```

**Current assumption:** Option A (weight selector 2-8kg, display as "Iron 3kg - 240 PHP")

**Impact:** Changes iron calculation and display

---

### 6. Delivery Fee Override Scope

**Question:** Does delivery fee override apply to:

- Entire order (one price for whole delivery)? | THIS
- Per basket (different baskets have different delivery fees)?
- First basket only (set once, rest inherit)?

**Current assumption:** Entire order (one delivery fee shown in summary)

**Impact:** Affects handling section and breakdown.fees structure

---

### 7. Product Images in POS

**Question:** Should we display product images in the product selection pane?

Considerations:

- Supabase free tier bandwidth concerns
- Performance impact on Supabase storage
- User experience (images help cashier verify product)

**Options:**

- Yes, with lazy-loading (load on demand)
- Yes, cached (load once, cache in browser) | LETS TRY THIS
- No, text-only with product name/price/quantity
- Thumbnail + full image on hover

**Impact:** Changes product selection UI and performance

---

### 8. Review/Summary Step Before Payment

**Question:** What should the review step contain?

Should it be:

```
═══════════════════════════════════════
  ORDER REVIEW
═══════════════════════════════════════

  Customer: John Doe
  Phone: 09123456789

  ─────────────────────────────────────
  Baskets & Services:
  ─────────────────────────────────────
  Basket 1:
    ✓ Wash (Basic) - 80 PHP
    ✓ Dry (Premium) - 65 PHP
    ✓ Spin - 20 PHP
    ✓ Iron (3kg) - 240 PHP
  Subtotal Services: 405 PHP

  ─────────────────────────────────────
  Products:
  ─────────────────────────────────────
  Plastic Bag × 2 - 6 PHP
  Subtotal Products: 6 PHP

  ─────────────────────────────────────
  Fees:
  ─────────────────────────────────────
  Service Charge: 40 PHP
  Delivery Fee: 50 PHP
  Subtotal: 501 PHP

  ─────────────────────────────────────
  Taxes & Discounts:
  ─────────────────────────────────────
  VAT (Included): 56.25 PHP
  Loyalty Discount: -50 PHP

  ─────────────────────────────────────
  TOTAL: 507.25 PHP
  ═════════════════════════════════════
  [← BACK] [PROCEED TO PAYMENT →]
```

Or something simpler? YOU ARE USING ADDITIVE TAX IN COMPUTAION AGAIN! SUBTOTAL IS ALREADY 501.00 AND THERE IS A -50.00 PHP DISCOUNT. THEREFOR TOTAL SHOULD BE 451.00! TAX IS COMPUTED FROM SUBTOTAL, NOT ADDED!

**Impact:** Affects review step design

---

### 9. Overpayment Handling (Still Unclear)

**Question:** You said "Your call, IDK" - let me decide: Should we allow overpayment?

Option A (Strict):

```
Total: 500 PHP
Customer gives: 1000 PHP
❌ Error: "Amount exceeds total. Enter exact amount or less."
```

Option B (Allow with change): | THIS.

```
Total: 500 PHP
Customer gives: 1000 PHP
✓ Change: 500 PHP
```

Option C (Allow + deposit):

```
Total: 500 PHP
Customer gives: 1000 PHP
✓ Change: 500 PHP (or save as credit toward next order?)
```

**Standard POS behavior:** Option B (allow overpayment, give change)

**Recommendation:** Go with Option B

**Impact:** Changes payment calculation logic

---

### 10. Basket Creation Auto-Logic

**Question:** When does a new basket automatically get created?

Scenario A: Cashier configures Basket 1 (8kg) and wants to add more services?

- Does system auto-create Basket 2?
- Or does cashier need to click "Add Basket" button?

Scenario B: Cashier enters laundry details that exceed 8kg?

- Does system prevent entry with error?
- Or does system auto-split into multiple baskets?

**Current assumption:** Manual "Add Basket" button (no auto-creation)

**Impact:** Affects basket creation UX

THERE IS NO BASKET AUTO-CREATION LOGIC. CASHIER HAS TO CLICK A BUTTON TO ADD ONE

---

### 11. Wash Cycle Details

**Question:** You said basic = default 2 cycles, premium = 3 cycles. Can cashier adjust this?

Option A (Fixed):

```
Wash: [Off] [Basic (2x)] [Premium (3x)]  ← No adjustment
```

Option B (Adjustable): | THIS. IF BASIC, ALLOW 1 OR 2 CYCLES, DEFAULT TO 1. IF PREMIUM, SELECT 3 AND DISABLE CYCLE CHANGES.

```
Wash: [Off] [Basic] [Premium]
Cycles: [1] [2] [3]  ← Separate selector
```

**Current assumption:** Option A (fixed cycles)

**Impact:** Changes wash selection UI

---

### 12. Iron Minimum 2kg - Validation

**Question:** When iron is selected, how to enforce 2kg minimum?

Option A (Prevent lower): | THIS. BUT DONT USE RADIOS. USE -/+. FROM OFF (O), THE FIRST '+' CLICK JUMPS TO 2, THEN 3, 4, 5, SO ON...

```
Iron: [Off] [2kg] [3kg] [4kg] [5kg] [6kg] [7kg] [8kg]
      ← Can't select lower than 2kg
```

Option B (Allow entry with warning):

```
Iron Weight: [−] 1 [+] kg
❌ Warning: "Minimum 2kg required"
[Apply] ← Disabled until >= 2kg
```

**Current assumption:** Option A (only show 2kg minimum options)

**Impact:** Changes iron weight selector design

---

### 13. Service Pricing - Need Exact Numbers

**Question:** Confirm exact pricing for all services:

```
✓ Wash Basic: 65 PHP per basket
✓ Wash Premium: 80 PHP per basket
✓ Dry Basic: 65 PHP per basket
✓ Dry Premium: 80 PHP per basket
✓ Spin: 20 PHP per basket
✓ Iron: 80 PHP per kg (2-8kg)
✓ Fold: ??? PHP per basket | NONE, remove this
✓ Plastic Bag: 3 PHP each (product)
✓ Service Charge (staff-service): 40 PHP per order
✓ Delivery Fee: 50 PHP default (override min 50)
✓ Additional Dry Time: 15 PHP per 8-minute increment
? VAT: 12% inclusive (not additional)
? Spin description: "double rinse" - what does this mean? (Not relevant to pricing) | TYPO, SPIN HAS NO DESCRIPTION
```

**Missing:** Fold pricing

**Impact:** Affects receipt calculation

---

## Summary: What We Need Before Building

### Must-Have Answers (Blocking)

1. Self-service vs staff-service: Per basket or per order?
2. Drop-off checkbox: Where in UI?
3. Plastic bag: Show where in basket?
4. Fold pricing: What's the cost?

### Nice-to-Have Clarifications (Can assume reasonable defaults)

5. Dry adjustments: Single selection or multiple?
6. Iron service: Single selector (2-8kg) or separate service?
7. Delivery fee: Order-level or per-basket?
8. Product images: Yes or no?
9. Review step: What level of detail?
10. Overpayment: Option B (allow + give change)?
11. Basket creation: Manual button or auto-split?
12. Wash cycles: Fixed or adjustable?
13. Iron minimum: Force 2kg minimum or prevent lower?

---

## Next Steps

1. **Answer the 4 blocking questions** → We can start building
2. **Clarify remaining 9** → Design will be more polished
3. **Create database schema changes** → Add/modify tables
4. **Create API specification** → Document new endpoints
5. **Build new POS UI** → Step by step

---

**Once you answer these, we're ready to start implementation!**
