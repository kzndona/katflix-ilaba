# API Implementation Roadmap - Order Creation

**Date:** January 27, 2026  
**Current Status:** UI/Frontend Complete ✅  
**Next Phase:** API & Database Transaction Layer

---

## 📊 Current Progress

### ✅ COMPLETE - Frontend (src/app/in/pos/page.tsx)

- **Step 1:** Service Type Selection (Self vs Staff) ✓
- **Step 2:** Basket Configurator (Wash/Dry/Spin/Iron/Fold) ✓
- **Step 3:** Products Selection (4-column grid) ✓
- **Step 4:** Customer Lookup/Creation ✓
- **Step 5:** Handling (Pickup/Delivery with fee) ✓
- **Sidebar:** Order summary with sticky bottom section ✓
- **Payment:** Numeric keypad, cash/gcash, change calculation ✓
- **Services Display:** Indented under baskets, zero-value filtering ✓
- **Iron Logic:** Skips 1kg (0 → 2 → 3...8) ✓

**State Management:** All in single component, ready to extract

---

## 🚀 Next Steps (Ordered)

### Phase 1: Backend Support Endpoints Verification (1 day)

**Check which endpoints exist:**

1. `GET /api/services` - Verify returns correct service structure
2. `GET /api/products` - Verify includes image_url, quantity, reorder_level
3. `GET /api/customers/search?q=` - **May not exist, needs verification**
4. `POST/PUT /api/customers` - **May not exist, needs verification**

**What to do:**
- [ ] Check if customer endpoints exist
- [ ] If not, create them (simple CRUD)
- [ ] Ensure all endpoints return proper data shapes

---

### Phase 2: Create Utility/Helper Files (1 day)

#### 2a. `src/app/in/pos/logic/posTypes.ts` - Type Definitions

```typescript
// Types for:
// - Basket
// - OrderItem (product)
// - OrderBreakdown
// - OrderHandling
// - OrderResponse
// - ValidationErrors
```

**Requirements:**
- All services structure (wash, dry, spin, iron, etc.)
- Pricing calculations
- Fee structures
- Payment methods

#### 2b. `src/app/in/pos/logic/breakdownBuilder.ts` - JSONB Assembly

```typescript
// Function: buildBreakdown(baskets, products, serviceType)
// Output: Properly formatted OrderBreakdown JSONB

// Function: buildHandling(customer, pickup/delivery, payment)
// Output: Properly formatted OrderHandling JSONB

// Calculations:
// - Basket subtotals (services pricing)
// - Product totals
// - Service fee (40 if staff-service)
// - Delivery fee (50 default, min 50)
// - VAT (12% inclusive)
// - Loyalty discount
// - Final total
```

**Requirements:**
- Exact price calculations matching UI
- Proper JSONB structure per schema
- Error handling for edge cases

#### 2c. `src/app/in/pos/logic/posValidation.ts` - Input Validation

```typescript
// Function: validateOrderBreakdown(breakdown)
// - Products exist and in stock
// - Prices match current rates
// - Weight limits respected
// - No negative quantities

// Function: validateOrderHandling(handling)
// - Delivery fee >= 50 if delivery
// - Valid payment method
// - Amount received >= total (for cash)
// - Reference provided (for gcash)

// Function: validateCustomer(customer)
// - Required fields present
// - Valid phone format
// - Valid email (if provided)
```

**Requirements:**
- All validation rules from guide
- Clear error messages
- Server-side validation (never trust client)

---

### Phase 3: Create Order API Endpoint (1.5 days)

#### Main Endpoint: `POST /api/orders/pos/create`

**Request Body:**

```typescript
{
  breakdown: OrderBreakdown,  // From breakdownBuilder
  handling: OrderHandling,    // From breakdownBuilder
  customer_id: string | null,
  customer_data: {            // If new customer
    first_name: string,
    last_name: string,
    phone: string,
    email?: string
  }
}
```

**Response (Success 200):**

```typescript
{
  order_id: string,
  order_number: string,  // Auto-generated like "ORD-2026-001234"
  receipt: {
    customer_name: string,
    items: OrderItem[],
    baskets: OrderBasket[],
    fees: Fee[],
    subtotal: number,
    vat: number,
    total: number,
    payment_method: string,
    amount_paid: number,
    change: number,
    gcash_reference?: string,
    created_at: string
  }
}
```

**Response (Error 400):**

```typescript
{
  error: string,
  details: {
    field: string,
    message: string
  }[]
}
```

**Response (Error 402 - Insufficient Stock):**

```typescript
{
  error: "Insufficient stock",
  items: {
    product_id: { required: 10, available: 5 }
  }
}
```

---

### Phase 4: Database Transaction Logic (1.5 days)

**Endpoint Implementation Flow:**

```
1. VALIDATE INPUT
   └─ breakdownBuilder.validate()
   └─ posValidation.validateOrderBreakdown()
   └─ posValidation.validateOrderHandling()
   └─ posValidation.validateCustomer()

2. CHECK INVENTORY
   └─ Query products table
   └─ Verify qty in stock for each product_id
   └─ Return 402 if insufficient

3. CREATE/UPDATE CUSTOMER (if needed)
   └─ If customer_id: fetch & verify
   └─ If customer_data: create new customer
   └─ Return customer_id

4. CREATE ORDER (Atomic Transaction)
   └─ INSERT into orders table
      - breakdown JSONB
      - handling JSONB
      - customer_id
      - status: 'pending'
      - created_at: now()
   
5. DEDUCT INVENTORY
   └─ INSERT into product_transactions table
      - order_id
      - product_id
      - qty_deducted (negative)
      - type: 'order'
      - reference: order_id
   
   └─ UPDATE products table
      - quantity -= sum(qty_deducted)

6. RETURN RECEIPT
   └─ Query created order
   └─ Format receipt from breakdown
   └─ Return 200 with receipt

ON ERROR (any step):
   └─ ROLLBACK entire transaction
   └─ Return appropriate error code
```

**Key Requirements:**
- Use database transactions (BEGIN/COMMIT/ROLLBACK)
- Use Supabase service key (server-side only)
- Atomic: All or nothing
- Idempotent: Safe to retry
- Audit: Track who created order (from auth context)

---

### Phase 5: Frontend Integration (0.5 days)

**Modifications to `src/app/in/pos/page.tsx`:**

1. Extract state to custom hook (optional but cleaner):
   ```typescript
   const pos = usePOSState();  // Instead of useState scattered
   ```

2. Add submit handler:
   ```typescript
   const handleCheckout = async () => {
     try {
       const breakdown = buildBreakdown(pos.baskets, pos.selectedProducts, pos.serviceType);
       const handling = buildHandling(pos.customer, pos.handling, pos.payment);
       
       const response = await fetch('/api/orders/pos/create', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           breakdown,
           handling,
           customer_id: pos.customer?.id || null,
           customer_data: pos.newCustomer || null
         })
       });
       
       if (!response.ok) throw new Error(await response.text());
       
       const { receipt } = await response.json();
       showReceiptModal(receipt);
     } catch (error) {
       showError(error.message);
     }
   };
   ```

3. Connect checkout button to handler
4. Show loading state during submission
5. Display errors clearly
6. Show receipt modal on success

---

## 📋 Implementation Checklist

### Week 1 Tasks

- [ ] **Day 1: Verify Support Endpoints**
  - [ ] Check GET /api/services
  - [ ] Check GET /api/products
  - [ ] Create GET /api/customers/search?q= (if missing)
  - [ ] Create POST/PUT /api/customers (if missing)

- [ ] **Day 2-3: Build Helpers**
  - [ ] Create posTypes.ts with all type definitions
  - [ ] Create breakdownBuilder.ts with calculation functions
  - [ ] Create posValidation.ts with validation rules
  - [ ] Test helpers independently

- [ ] **Day 4-5: Build API Endpoint**
  - [ ] Create POST /api/orders/pos/create
  - [ ] Implement transaction logic
  - [ ] Add error handling
  - [ ] Test with Postman/curl

- [ ] **Day 6: Frontend Integration**
  - [ ] Connect checkout button to API
  - [ ] Add loading/error states
  - [ ] Show receipt modal
  - [ ] End-to-end testing

---

## 🔐 Security Checklist

- [ ] Server-side validation (never trust client)
- [ ] Service key only in server routes
- [ ] Public key only in client
- [ ] SQL injection protection (use Supabase parameterized queries)
- [ ] RLS policies verified
- [ ] Authentication context checked (user who created order)
- [ ] No PII in error messages
- [ ] Rate limiting considered (prevent order spam)

---

## 📊 Database Tables Affected

### Orders Table

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  breakdown JSONB NOT NULL,    -- All order items & baskets
  handling JSONB NOT NULL,     -- Delivery/payment details
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  updated_by TEXT             -- User email/ID
);
```

### Product_Transactions Table (Inventory Deduction)

```sql
CREATE TABLE product_transactions (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  qty_deducted NUMERIC NOT NULL,  -- Negative for orders
  type TEXT,                       -- 'order', 'adjustment', 'return'
  reference TEXT,                  -- order_id or notes
  created_at TIMESTAMP DEFAULT now()
);
```

### Products Table (Stock Updated)

```sql
-- quantity field DECREMENTED via transaction
UPDATE products SET quantity = quantity - ? WHERE id = ?;
```

---

## 🧪 Testing Strategy

### Unit Tests (For Helpers)

```typescript
// posValidation.test.ts
test('validateDeliveryFee rejects < 50', () => {
  expect(() => validateDeliveryFee(40)).toThrow();
});

test('validateOrderBreakdown rejects OOS products', () => {
  const breakdown = { items: [{ product_id: 'xyz', qty: 10 }] };
  expect(() => validateOrderBreakdown(breakdown, mockProducts)).toThrow();
});

// breakdownBuilder.test.ts
test('buildBreakdown calculates correct VAT', () => {
  const bd = buildBreakdown(baskets, products, 'self_service');
  expect(bd.summary.vat).toBe(subtotal * 0.12);
});
```

### Integration Tests (For API)

```typescript
// POST /api/orders/pos/create
test('201 - Valid order creates successfully', async () => {
  const res = await POST_create(validPayload);
  expect(res.status).toBe(200);
  expect(res.body.order_id).toBeDefined();
});

test('400 - Missing customer throws validation error', async () => {
  const res = await POST_create({ ...validPayload, customer_id: null });
  expect(res.status).toBe(400);
});

test('402 - Insufficient stock blocked', async () => {
  const res = await POST_create(outOfStockPayload);
  expect(res.status).toBe(402);
});

test('Inventory deducted correctly', async () => {
  const before = await getProductQty('product-1');
  await POST_create(validPayload);
  const after = await getProductQty('product-1');
  expect(after).toBe(before - 5);
});
```

### Manual E2E Test (In Browser)

1. Load POS page
2. Add 2 baskets with different services
3. Add 3 products to order
4. Select customer
5. Choose delivery with address
6. Choose payment method
7. Enter amount/reference
8. Click checkout
9. Verify receipt displays
10. Check database: Order + Product_Transactions created
11. Verify inventory decremented

---

## 🎯 Success Criteria

When complete, you should be able to:

1. ✅ Submit order from POS frontend
2. ✅ Backend validates all inputs
3. ✅ Customer created/linked
4. ✅ Order saved to database with complete breakdown
5. ✅ Inventory deducted atomically
6. ✅ Receipt returned and displayed
7. ✅ All error cases handled gracefully
8. ✅ Can create multiple orders in sequence
9. ✅ Inventory stays consistent (no duplicates, no negatives)
10. ✅ Audit trail shows who created order & when

---

## 📝 Files to Create/Modify

```
src/app/in/pos/
├── page.tsx (MODIFY - add checkout handler)
└── logic/
    ├── posTypes.ts (NEW)
    ├── breakdownBuilder.ts (NEW)
    └── posValidation.ts (NEW)

src/app/api/orders/
└── pos/
    └── create/
        └── route.ts (NEW)

src/app/api/customers/
├── search/
│   └── route.ts (VERIFY/CREATE)
└── route.ts (VERIFY/CREATE)
```

---

## ⚠️ Known Issues to Avoid

1. **Don't** calculate VAT on client - backend must validate
2. **Don't** trust product prices from frontend - fetch fresh from DB
3. **Don't** allow inventory to go negative (use locks/transactions)
4. **Don't** create order before inventory check passes
5. **Don't** forget to rollback on ANY error
6. **Don't** expose error details to client (log internally)
7. **Don't** process payment before order confirmed
8. **Don't** forget to increment order_number (unique, sequential)

---

## 🔗 Reference Documentation

- [NEW_AGENT_HANDOFF.md](NEW_AGENT_HANDOFF.md) - Complete specification
- [POS_OVERHAUL_CRITICAL_REVIEW_ANSWERS.md](POS_OVERHAUL_CRITICAL_REVIEW_ANSWERS.md) - Q&A clarifications
- Database schema in handoff guide
- JSONB structures in handoff guide

---

**Ready to start? Begin with Phase 1: Verify support endpoints.**
