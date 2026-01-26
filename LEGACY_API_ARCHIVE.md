# Legacy API Archive

**Date:** January 26, 2026  
**Reason:** Phase 1.2 complete redesign of order creation flow with new schema

---

## Archived APIs

These endpoints were replaced by the Phase 1.2 specification. They are documented here for reference but have been removed from the codebase.

### 1. POST /api/orders (Legacy)
**File:** `src/app/api/orders/route.ts`  
**Purpose:** Internal endpoint for POS order creation (old format)  
**Status:** ❌ REMOVED - Replaced by POST /api/orders/pos/create  
**Reason:** Old format used separate breakdown/handling fields. New spec uses unified order_data JSONB.

**Old Request:**
```json
{
  "source": "store",
  "customer_id": "uuid",
  "cashier_id": "uuid",
  "status": "processing",
  "total_amount": 500,
  "breakdown": { ...JSONB... },
  "handling": { ...JSONB... }
}
```

**Migration:** All order creation must now use POST /api/orders/pos/create with full validation and customer handling.

---

### 2. GET /api/orders/getOrders
**File:** `src/app/api/orders/getOrders/route.ts`  
**Purpose:** Retrieve orders list  
**Status:** ❌ REMOVED  
**Reason:** Functionality merged into dashboard/reporting features. Use database directly for admin queries.

---

### 3. GET /api/orders/getOrdersWithBaskets
**File:** `src/app/api/orders/getOrdersWithBaskets/route.ts`  
**Purpose:** Retrieve orders with basket details  
**Status:** ❌ REMOVED  
**Reason:** Order retrieval now handled by GET /api/orders/:id with full relationship loading.

---

### 4. POST /api/orders/saveOrder
**File:** `src/app/api/orders/saveOrder/route.ts`  
**Purpose:** Save/update order  
**Status:** ❌ REMOVED  
**Reason:** Order updates now use specific endpoints (PATCH /api/orders/:id/service-status, POST /api/orders/:id/cancel).

---

### 5. DELETE /api/orders/removeOrder
**File:** `src/app/api/orders/removeOrder/route.ts`  
**Purpose:** Delete order  
**Status:** ❌ REMOVED  
**Reason:** Orders should not be deleted. Use cancellation (POST /api/orders/:id/cancel) instead for audit trail.

---

### 6. POST /api/orders/transactional-create
**File:** `src/app/api/orders/transactional-create/route.ts`  
**Purpose:** Transactional order creation endpoint  
**Status:** ❌ REMOVED  
**Reason:** Replaced by POST /api/orders/pos/create which includes all transaction logic.

---

### 7. PATCH /api/orders/:id/service-status (Old)
**File:** `src/app/api/orders/[id]/serviceStatus/route.ts`  
**Purpose:** Update service status in order  
**Status:** ⚠️ KEPT but may need refactoring  
**Note:** Complex logic for service sequencing. Review before Phase 2.

---

### 8. POST /api/orders/:id/reject
**File:** `src/app/api/orders/[id]/reject/route.ts`  
**Purpose:** Reject an order  
**Status:** ❌ REMOVED  
**Reason:** Functionality subsumed into POST /api/orders/:id/cancel.

---

## Utility Files Archived

### inventoryHelpers.ts
**File:** `src/app/api/orders/inventoryHelpers.ts`  
**Status:** ❌ REMOVED  
**Reason:** Inventory deduction now handled directly in POST /api/orders/pos/create  
**Content:** Helper functions for stock deduction

---

## Database Validators Removed

Old validation patterns are no longer used:
- Order format validators (old breakdown structure)
- Service sequence validators (now enforced at UI level)
- Payment validators (now in POST /api/orders/pos/create)

---

## Migration Checklist

When testing Phase 1.2 endpoints:

- [x] All order creation must use POST /api/orders/pos/create
- [x] Customer handling is automatic (create/update in same endpoint)
- [x] Inventory deduction included in transaction
- [x] No separate validator calls needed
- [x] Cancellation uses POST /api/orders/:id/cancel (with inventory restoration)
- [ ] Review service-status endpoint complexity (may need refactoring)

---

## Files That Still Exist

**Kept (Review for refactoring):**
- `src/app/api/orders/[id]/service-status/route.ts` - Complex service sequencing logic
- `src/app/api/orders/[id]/route.ts` - Updated for Phase 1.2 auth
- Email/receipt endpoints - Existing Resend implementation

**Removed:**
- route.ts (POST)
- getOrders/route.ts
- getOrdersWithBaskets/route.ts
- saveOrder/route.ts
- removeOrder/route.ts
- transactional-create/route.ts
- [id]/reject/route.ts
- inventoryHelpers.ts

---

## API Changes Summary

| Old Endpoint | New Endpoint | Status |
|---|---|---|
| POST /api/orders | POST /api/orders/pos/create | ✅ Replaced |
| GET /api/orders/getOrders | N/A (Dashboard) | ❌ Removed |
| GET /api/orders/getOrdersWithBaskets | GET /api/orders/:id | ✅ Replaced |
| POST /api/orders/saveOrder | PATCH /api/orders/:id/* | ✅ Replaced |
| DELETE /api/orders/removeOrder | POST /api/orders/:id/cancel | ✅ Replaced |
| POST /api/orders/transactional-create | POST /api/orders/pos/create | ✅ Replaced |
| POST /api/orders/:id/reject | POST /api/orders/:id/cancel | ✅ Replaced |

---

## Next Steps

1. Verify Phase 1.2 endpoints work with new schema
2. Remove service-status complexity if possible (refactor in Phase 3)
3. Test full order flow: create → retrieve → cancel
4. Update UI to call new endpoints

