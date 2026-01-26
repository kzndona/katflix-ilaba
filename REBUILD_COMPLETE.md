# POS System Rebuild - Complete ✅

**Date:** January 27, 2026  
**Status:** Phase 1 (UI/Logic) + Phase 2 (API) - COMPLETE  
**Testing:** Ready for Phase 3

---

## 📋 What Was Built

### Clean Architecture (From Scratch)

#### 1. **Type Definitions** (`src/app/in/pos/logic/posTypes.ts`)
- `OrderBreakdown` - JSONB structure for order items, baskets, fees, summary
- `OrderHandling` - JSONB structure for delivery/pickup, payment, instructions
- `Basket` - Per-basket services (wash, dry, spin, iron, fold, additional dry time)
- `Service` & `POSProduct` - Database entity types
- Clear separation: service types, payment methods, handling types

**Key Design:**
- Per-ORDER staff service fee (₱40) - not per basket
- Flat service pricing (not rate_per_kg)
- Iron: minimum 2kg, skip if < 2kg
- Auto-basket when weight > 8kg
- 12% VAT inclusive

#### 2. **Helper Functions** (`src/app/in/pos/logic/posHelpers.ts`)
- `calculateBasketSubtotal()` - Services pricing
- `calculateBasketDuration()` - Time estimates
- `buildOrderBreakdown()` - Complete order summary
- `autoCreateBasketIfNeeded()` - 8kg weight limit enforcement
- `validateDeliveryFee()` - Min ₱50
- `calculateVATAmount()` - 12% inclusive extraction
- `calculateChange()` - Cash payment
- `normalizeIronWeight()` - Min 2kg enforcement

#### 3. **State Management** (`src/app/in/pos/logic/usePOSState.ts`)
- Central `usePOSState()` hook managing:
  - Workflow step (0-6)
  - Global service type (self/staff)
  - Baskets with auto-creation
  - Products with quantities
  - Customer search + create
  - Delivery details
  - Payment (cash/GCash)
- Debounced customer search (300ms)
- Real-time calculation via `calculateOrderTotal()`
- Order creation via API
- Receipt modal management

#### 4. **UI Components** (`src/app/in/pos/page.tsx`)
**6-Step Workflow:**
- **Step 0:** Service Type Selector (self-service vs staff-service)
- **Step 1:** Basket Configurator (weight, services, notes)
- **Step 2:** Product Selector (grid with images, quantity controls)
- **Step 3:** Customer Lookup (search, create inline)
- **Step 4:** Delivery Handler (pickup/delivery, address, fee)
- **Step 5:** Order Review (summary before payment)
- **Step 6:** Payment Modal (cash amount + change, or GCash ref)

**Layout:**
- Left: Scrollable form (steps 0-6)
- Right: Sticky order summary (real-time updates, ₱ formatting)
- Receipt modal (after successful order)

**UI Standards (from services/products pages):**
- Headers: `text-2xl font-bold mb-4`
- Labels: `text-xs font-semibold mb-1`
- Inputs: `px-3 py-2 border border-gray-300 rounded`
- Buttons: `px-4 py-2 text-sm`
- Financial: `₱${value.toFixed(2)}`

#### 5. **API Endpoint** (`src/app/api/orders/pos/create/route.ts`)
**POST /api/orders/pos/create**

**Request:**
```typescript
{
  customer_id?: string;
  customer_data?: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
  };
  breakdown: OrderBreakdown;
  handling: OrderHandling;
}
```

**Response:**
```typescript
{
  success: boolean;
  order_id: string;
  receipt: {
    order_id: string;
    customer_name: string;
    items: OrderItem[];
    baskets: Basket[];
    total: number;
    payment_method: string;
    change?: number;
  };
}
```

**Logic:**
1. Authenticate user (staff)
2. Validate input (customer, breakdown, handling)
3. Create/get customer
4. Validate inventory (all products in stock)
5. Create order with JSONB (breakdown, handling)
6. Deduct inventory (product_transactions)
7. Generate receipt data
8. Return order ID + receipt

**Error Handling:**
- 401: Unauthorized / Staff not found
- 400: Missing/invalid input
- 404: Product not found
- 402: Insufficient stock
- 500: Database errors

---

## 🗂️ File Structure (NEW)

```
src/app/in/pos/
├── page.tsx                    ✅ REBUILT (6-step workflow, ~1000 lines)
├── logic/
│   ├── posTypes.ts             ✅ CREATED (clean types, no legacy)
│   ├── posHelpers.ts           ✅ CREATED (calculation functions)
│   └── usePOSState.ts          ✅ REBUILT (state hook, 450 lines)
└── components/                 (old pane-based components - can be deleted)

src/app/api/orders/pos/create/
└── route.ts                    ✅ CREATED (transactional endpoint)
```

---

## 📦 Archived Files

Old implementation saved in `_LEGACY_POS_ARCHIVE/`:
- `usePOSState.tsx` (767 lines, pane-based)
- `orderTypes.ts` (303 lines, complex)
- Old components (paneBaskets, paneCustomer, etc.)

**Can be deleted after testing is successful.**

---

## ✅ Business Logic Implementation

### ✅ Service Pricing (CORRECT NOW)
- **Wash Basic:** ₱65 per basket
- **Wash Premium:** ₱80 per basket
- **Dry Basic:** ₱65 per basket
- **Dry Premium:** ₱80 per basket
- **Spin:** ₱20 per basket
- **Iron:** ₱80/kg (min 2kg, max 8kg)
- **Fold:** ₱0 (included or free)
- **Additional Dry Time:** ₱15 per 8-min level (0, 8, 16, 24 min)

### ✅ Fees
- **Staff Service Fee:** ₱40 per ORDER (if staff_service selected)
- **Delivery Fee:** ₱50 default, min ₱50, cashier can override
- **VAT:** 12% inclusive (not added on top)

### ✅ Basket Management
- Max weight: 8kg
- Exceeding 8kg auto-creates new basket
- Iron: min 2kg (skip if < 2kg)
- Wash cycles: 1, 2, or 3 (only if wash != off)
- Per-basket notes

### ✅ Workflow
- Step 0: Service type (global choice)
- Step 1: Baskets with services
- Step 2: Products from inventory
- Step 3: Customer search or create
- Step 4: Pickup vs delivery
- Step 5: Review before payment
- Step 6: Cash (amount + change) or GCash (reference)

### ✅ Order Creation
- Creates customer if new
- Creates order with JSONB breakdown & handling
- Deducts inventory atomically
- Generates receipt
- Returns order ID

---

## 🚀 What's Next (Testing Phase)

### Unit Tests
- [ ] Basket auto-creation (8kg limit)
- [ ] Iron weight normalization (skip < 2kg)
- [ ] Delivery fee validation (min 50)
- [ ] VAT calculation (12% inclusive)
- [ ] Service fee logic (per order)
- [ ] Change calculation (cash)

### Integration Tests
- [ ] Full 6-step flow
- [ ] Customer creation
- [ ] Inventory deduction
- [ ] Receipt generation
- [ ] Error handling (insufficient stock, etc.)

### Manual Testing
- [ ] UI responsiveness
- [ ] Form validation
- [ ] Back/forward navigation
- [ ] Real-time summary updates
- [ ] Payment processing

---

## 📝 Key Decisions Made

1. **Per-ORDER Staff Service Fee:** ₱40 charged once if any basket has staff_service, not per basket
2. **Flat Pricing Model:** Services priced per basket, not rate_per_kg
3. **Iron Minimum:** Skip (don't ask) if weight < 2kg
4. **Auto-Baskets:** Create automatically when weight > 8kg (no user prompt)
5. **UI Layout:** Left form + right sticky summary (wide POS terminals)
6. **6 Steps:** Clear progression, each step isolated
7. **JSONB Storage:** breakdown and handling stored as JSONB, not separate tables

---

## ⚠️ Important Notes

1. **Old Components:** The old pane-based components are not used. Can be deleted after testing.
2. **Database:** No changes to schema required (breakdown/handling already JSONB in orders table)
3. **Inventory:** Requires `product_transactions` table for transaction logging
4. **Customer:** Search uses ilike on first_name, last_name, phone_number
5. **Loyalty:** Placeholder for future implementation (not yet integrated)

---

## 🎯 Success Criteria

All 7 criteria from overhaul guide should now work:

- ✅ Add service baskets with configurations
- ✅ Add product items from inventory
- ✅ Search and select customers (or create new)
- ✅ Specify delivery details with fee
- ✅ Calculate totals with VAT (12% inclusive)
- ✅ Process payment (cash or GCash)
- ✅ Create order with transactional safety

---

## 🔗 References

- [NEW_AGENT_HANDOFF.md](../../NEW_AGENT_HANDOFF.md) - Original spec
- [POS_overhaul_guide.txt](../../POS_overhaul_guide.txt) - Business workflow
- `_LEGACY_POS_ARCHIVE/` - Previous implementation for reference

---

**Status:** Ready for testing! 🚀
