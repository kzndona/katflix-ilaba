# POS Rebuild - Quick Testing Guide

## 🎯 Start Testing

### 1. Run Dev Server
```bash
npm run dev
```
Visit: http://localhost:3000/in/pos

### 2. Test Flow (Step-by-Step)

#### Step 0: Service Type
- [ ] Select "Self-Service" → click Next
- [ ] Go Back → Select "Staff-Service" (₱40 fee mentioned) → click Next

#### Step 1: Basket Configurator
- [ ] Enter weight: 5kg
- [ ] Select Wash: Premium (₱80)
- [ ] Select Dry: Basic (₱65)
- [ ] Toggle Spin: ON (₱20)
- [ ] Toggle Iron: OFF
- [ ] Additional Dry Time: +8min (₱15)
- [ ] Expected Basket Subtotal: ₱180 (80+65+20+15, no iron)
- [ ] Try entering 10kg weight → Should auto-create Basket 2 with 2kg
- [ ] Delete Basket 2, verify it works
- [ ] Click "+ Add Basket" → Add Basket 2 manually
- [ ] Click Next

#### Step 2: Product Selector
- [ ] See products with images and prices
- [ ] Click "Add to Order" on Plastic Bag (₱3)
- [ ] Increase quantity to 3
- [ ] Add another product (e.g., Detergent)
- [ ] Check summary updates on right sidebar
- [ ] Click Next

#### Step 3: Customer Lookup
- [ ] Type in search box → Should show debounced results (300ms delay)
- [ ] Select existing customer (if any)
- [ ] OR toggle "+ Create New Customer"
- [ ] Fill: First Name, Last Name, Phone, Email (optional)
- [ ] Click "Create Customer"
- [ ] Verify customer appears in green box
- [ ] Click "Change Customer" to clear
- [ ] Create a new customer again
- [ ] Click Next

#### Step 4: Delivery Handler
- [ ] Select "Pickup in Store" → No address field shown
- [ ] Switch to "Delivery to Address" → Address field appears
- [ ] Enter fake address: "123 Main St, Manila"
- [ ] Change delivery fee to 60 (override default 50)
- [ ] Try to enter 45 → Should stay at 50 (validation)
- [ ] Add special instructions: "Handle with care"
- [ ] Click Next

#### Step 5: Order Review
- [ ] Review all baskets, products, customer, delivery shown
- [ ] Verify totals in right sidebar match review
- [ ] Click Next

#### Step 6: Payment Modal
- [ ] Total shown in yellow banner
- [ ] Select "Cash"
- [ ] Enter amount paid: Total + 20 (to test change)
- [ ] Verify change calculated correctly
- [ ] Try insufficient amount → Button disabled
- [ ] Switch to "GCash"
- [ ] Enter reference number: "GC12345"
- [ ] Click "Create Order"

#### Receipt Modal
- [ ] Should show order ID
- [ ] Should show receipt content (or at least order ID)
- [ ] Click "Print" (or "Close")
- [ ] Should reset form for new order

### 3. Order Summary Sidebar (throughout all steps)
- [ ] Check it updates real-time as you change values
- [ ] Verify ₱ formatting (₱X.XX)
- [ ] Check step indicator at bottom (Step 1 of 6, etc.)
- [ ] Verify totals are accurate:
  - Subtotal Services = sum of basket subtotals
  - Subtotal Products = sum of product totals
  - Staff Service Fee = ₱40 (if staff service selected in step 0)
  - Delivery Fee = ₱0 (pickup) or ₱50+ (delivery)
  - VAT = calculated at 12% inclusive
  - TOTAL = final amount

### 4. Edge Cases
- [ ] No baskets, only products → Should still calculate
- [ ] Multiple baskets (5kg + 6kg + 2kg) → Auto-created
- [ ] Iron at 1.5kg → Should skip (= 0)
- [ ] Iron at 2.5kg → Should accept (= 2 or normalize?)
- [ ] Delivery fee below 50 → Should validate to 50
- [ ] Cash payment with insufficient amount → Button disabled
- [ ] GCash without reference → Button disabled

### 5. Database Validation (if available)
After successful order creation:
```sql
-- Check order was created
SELECT id, customer_id, status, total_amount, breakdown, handling
FROM orders
ORDER BY created_at DESC
LIMIT 1;

-- Check inventory was deducted
SELECT product_id, quantity
FROM products
WHERE item_name LIKE '%Plastic Bag%';

-- Check product_transactions logged
SELECT product_id, quantity_change, order_id
FROM product_transactions
ORDER BY created_at DESC
LIMIT 5;
```

---

## ✅ What Should Work

1. **Navigation:** Back/forward buttons between all 6 steps
2. **Auto-basket:** Weight > 8kg creates new basket automatically
3. **Service Fee:** Appears in summary if staff-service selected in step 0
4. **Delivery Fee:** ₱0 for pickup, ₱50+ for delivery
5. **Products:** Can add, increase quantity, remove
6. **Customer:** Can search (debounced), select, or create new
7. **Payment:** Cash (with change) or GCash (with reference)
8. **Calculations:** VAT 12% inclusive, totals accurate
9. **Order Creation:** Should succeed and return order ID
10. **Receipt:** Should display after order creation

---

## ❌ Known Limitations (for now)

- Loyalty points not yet integrated
- Receipt content may be minimal (order ID + date)
- Google Maps integration not yet done (text address only)
- Print functionality not implemented (can be added later)
- No pagination on customer search results

---

## 🐛 Common Issues to Check

- [ ] Tailwind CSS classes applied correctly (spacing, colors)
- [ ] Responsive on desktop (POS terminals are typically 1024px+)
- [ ] Form validation messages appear
- [ ] Buttons disabled appropriately (e.g., can't proceed without customer)
- [ ] Real-time summary updates as you type
- [ ] No console errors (check browser DevTools)
- [ ] API endpoint reachable at /api/orders/pos/create

---

## 📊 Test Report Template

**Date:** ___________  
**Tester:** ___________

| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 0 | Service Type | ✅/❌ | |
| 1 | Basket Config | ✅/❌ | |
| 1 | Auto-basket (8kg) | ✅/❌ | |
| 2 | Products | ✅/❌ | |
| 3 | Customer Search | ✅/❌ | |
| 3 | Create Customer | ✅/❌ | |
| 4 | Pickup/Delivery | ✅/❌ | |
| 4 | Delivery Fee | ✅/❌ | |
| 5 | Order Review | ✅/❌ | |
| 6 | Payment (Cash) | ✅/❌ | |
| 6 | Payment (GCash) | ✅/❌ | |
| API | Order Creation | ✅/❌ | |
| DB | Inventory Deducted | ✅/❌ | |

---

**Questions?** Refer to [REBUILD_COMPLETE.md](./REBUILD_COMPLETE.md) for architecture details.
