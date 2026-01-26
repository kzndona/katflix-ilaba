# 🎯 POS Rebuild - Quick Reference

## What Changed?

### ❌ Old System

- Pane-based UI (sidebar tabs)
- Per-kg service pricing (rate_per_kg)
- Service fee per-basket
- Unclear auto-basket logic
- Complex nested types

### ✅ New System

- 6-step workflow UI
- Flat service pricing
- Service fee per-ORDER
- Clear 8kg auto-basket
- Clean types

---

## 6-Step Workflow

```
Step 0: Service Type      (self vs staff)
   ↓
Step 1: Baskets           (weight, services)
   ↓
Step 2: Products          (items + quantities)
   ↓
Step 3: Customer          (search/create)
   ↓
Step 4: Delivery          (pickup/delivery)
   ↓
Step 5: Order Review      (verify all)
   ↓
Step 6: Payment           (cash/GCash)
```

---

## Key Rules

| Rule                   | Implementation                            |
| ---------------------- | ----------------------------------------- |
| **Basket Weight Max**  | 8kg → auto-create new basket              |
| **Iron Min**           | 2kg → skip if < 2kg                       |
| **Delivery Fee**       | ₱50 default, min ₱50                      |
| **Staff Service Fee**  | ₱40 per ORDER (not per basket)            |
| **VAT**                | 12% inclusive (not added on top)          |
| **Customer Search**    | Debounced 300ms                           |
| **Payment Validation** | Cash: sufficient amount, GCash: reference |

---

## File Locations

### Core Logic

```
src/app/in/pos/logic/
├── posTypes.ts       ← Data types
├── posHelpers.ts     ← Calculations
└── usePOSState.ts    ← State management
```

### UI

```
src/app/in/pos/
└── page.tsx          ← All 7 components + layout
```

### API

```
src/app/api/orders/pos/create/
└── route.ts          ← POST /api/orders/pos/create
```

---

## Start Testing

```bash
npm run dev
# Visit: http://localhost:3000/in/pos
```

See: [POS_TESTING_GUIDE.md](./POS_TESTING_GUIDE.md)

---

## Pricing Cheat Sheet

**Wash:** ₱65 (basic) or ₱80 (premium)  
**Dry:** ₱65 (basic) or ₱80 (premium)  
**Spin:** ₱20  
**Iron:** ₱80/kg (min 2kg)  
**Extra Dry Time:** ₱15 per 8-min level  
**Staff Fee:** ₱40 (if selected in Step 0)  
**Delivery:** ₱50+ (pickup = ₱0)  
**VAT:** 12% included

---

## API Call

```typescript
POST /api/orders/pos/create

{
  customer_id?: string,
  customer_data?: { first_name, last_name, phone_number, email? },
  breakdown: { items, baskets, fees, summary },
  handling: { service_type, handling_type, delivery_address?, delivery_fee?, payment_method, amount_paid }
}

Response:
{
  success: boolean,
  order_id: string,
  receipt: { order_id, customer_name, items, baskets, total, payment_method, change? }
}
```

---

## Common Tests

✅ **Auto-Basket:** Enter 10kg → should create 2 baskets (8kg + 2kg)  
✅ **Iron Skip:** Enter 1kg iron → should skip (= 0)  
✅ **Delivery Fee:** Enter 40 → should validate to 50  
✅ **Payment:** No amount → Create Order button disabled  
✅ **Customer:** Search for "John" → debounced results

---

## If Something Breaks

1. Check console errors (F12 → Console)
2. Check network errors (F12 → Network)
3. Verify database connection
4. See [POS_TESTING_GUIDE.md](./POS_TESTING_GUIDE.md)
5. See [REBUILD_COMPLETE.md](./REBUILD_COMPLETE.md)
6. Check [\_LEGACY_POS_ARCHIVE/](./c:\Users\kizen\Projects\katflix_ilaba_LEGACY_POS_ARCHIVE)

---

## Documentation

| Doc                                                                      | Purpose               |
| ------------------------------------------------------------------------ | --------------------- |
| [POS_REBUILD_SUMMARY.md](./POS_REBUILD_SUMMARY.md)                       | Executive overview    |
| [REBUILD_COMPLETE.md](./REBUILD_COMPLETE.md)                             | Detailed architecture |
| [POS_TESTING_GUIDE.md](./POS_TESTING_GUIDE.md)                           | Testing procedures    |
| [POS_REBUILD_DELIVERY_CHECKLIST.md](./POS_REBUILD_DELIVERY_CHECKLIST.md) | Deliverables list     |
| [POS_REBUILD_QUICK_REFERENCE.md](./POS_REBUILD_QUICK_REFERENCE.md)       | This file             |

---

**Total Implementation:** 2,500+ lines  
**Status:** ✅ Ready for Testing  
**Time to Deploy:** ~1 hour testing + fixes

---

_Quick Reference Card_  
_January 27, 2026_
