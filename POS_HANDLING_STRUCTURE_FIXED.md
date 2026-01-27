# POS Order Handling Structure - Fixed

## Problem

POS orders were creating with an incomplete handling structure. The pickup phase was showing in the timeline even for in-store orders because:

1. **Missing pickup address**: The handling object didn't have `pickup.address` set to "store"
2. **Incomplete handling structure**: Request only had payment info, not the full `pickup` and `delivery` objects with status
3. **Timeline logic**: Frontend couldn't determine if pickup should be skipped without the address

## Root Cause

The POS and mobile order creation endpoints were accepting incomplete handling data and not standardizing it to the proper structure before saving.

## Solution

### 1. POS Order Creation

**File: `src/app/api/orders/pos/create/route.ts`**

Now builds proper handling structure:

```typescript
const handling = {
  pickup: {
    address: "store", // Always "store" for POS
    status: "pending",
    started_at: null,
    completed_at: null,
  },
  delivery: {
    address: body.handling?.delivery_address || "store", // From request or default to "store"
    status: "pending",
    started_at: null,
    completed_at: null,
  },
  payment_method: body.handling?.payment_method || null,
  amount_paid: body.handling?.amount_paid || null,
};
```

### 2. Mobile Order Creation

**File: `src/app/api/orders/mobile/create/route.ts`**

Now builds proper handling structure:

```typescript
const handling = {
  pickup: {
    address: body.handling?.pickup_address || "", // From request (required for mobile)
    status: "pending",
    started_at: null,
    completed_at: null,
  },
  delivery: {
    address: body.handling?.delivery_address || "", // From request (required for mobile)
    status: "pending",
    started_at: null,
    completed_at: null,
  },
  payment_method: body.handling?.payment_method || null,
  amount_paid: body.handling?.amount_paid || null,
};
```

### 3. Timeline Logic Updated

**File: `src/app/in/baskets/page.tsx`**

Updated `getTimelineNextAction()` to recognize both "in-store" and "store":

```typescript
const pickupAddr = order.handling.pickup.address?.toLowerCase() || "";
const isStorePickup = pickupAddr === "in-store" || pickupAddr === "store";

// Skip pickup actions if store pickup
if (!isStorePickup && order.handling.pickup.status === "pending") {
  return { label: "Start Pickup", ... };
}
```

### 4. Timeline Rendering Updated

**File: `src/app/in/baskets/page.tsx`**

Pickup phase is hidden for both "in-store" and "store":

```tsx
{order.handling?.pickup &&
  order.handling.pickup.address?.toLowerCase() !== "in-store" &&
  order.handling.pickup.address?.toLowerCase() !== "store" &&
  (order.handling.pickup.status === "pending" || ...) && (
    <div>...</div>
)}
```

### 5. Service Endpoint Updated

**File: `src/app/api/orders/[orderId]/basket/[basketNumber]/service/route.ts`**

Auto-skips pickup for both "in-store" and "store":

```typescript
const pickupAddr = order.handling?.pickup?.address?.toLowerCase() || "";
const isStorePickup = pickupAddr === "in-store" || pickupAddr === "store";

if (isStorePickup && order.handling?.pickup?.status === "pending") {
  // Auto-mark pickup as skipped
  const updatedHandling = {
    ...order.handling,
    pickup: {
      ...order.handling.pickup,
      status: "skipped",
      completed_at: new Date().toISOString(),
    },
  };

  await supabase.from("orders").update({ handling: updatedHandling });
}
```

## Order Handling Structure

### Now Created As:

**POS Order:**

```json
{
  "handling": {
    "pickup": {
      "address": "store",
      "status": "pending",
      "started_at": null,
      "completed_at": null
    },
    "delivery": {
      "address": "store" | "delivery address",  // From request or default
      "status": "pending",
      "started_at": null,
      "completed_at": null
    },
    "payment_method": "cash" | "gcash",
    "amount_paid": 350.00
  }
}
```

**Mobile Order:**

```json
{
  "handling": {
    "pickup": {
      "address": "customer address", // From request
      "status": "pending",
      "started_at": null,
      "completed_at": null
    },
    "delivery": {
      "address": "delivery address", // From request
      "status": "pending",
      "started_at": null,
      "completed_at": null
    },
    "payment_method": "gcash",
    "amount_paid": 350.0
  }
}
```

## Behavior Changes

### POS Orders (Store Pickup)

**Before:**

- Pickup phase showed in timeline
- "Start Pickup" button appeared
- Confusing UX for in-store orders

**After:**

- Pickup phase is **hidden** from timeline
- No pickup buttons shown
- Services appear as first phase
- When service starts, pickup auto-marked as "skipped"
- Order flows: pending → processing → for_pick-up → completed

### Mobile Orders (Real Addresses)

**Unchanged:**

- Pickup phase shown (customer pickup address)
- Delivery phase shown (delivery address)
- Full workflow visible
- Order flows: pending → processing → for_pick-up → processing → completed

## Testing

Create a POS order now:

1. Go to POS page
2. Create order with "In-store" or "Store" delivery
3. Go to baskets page
4. Verify: ✓ Pickup phase is **NOT shown**
5. Verify: ✓ Services are first actionable phase
6. Click "Start [Service]"
7. Verify: ✓ Pickup auto-marked as "skipped" (check browser console for `[Store Pickup]` logs)
8. Complete services
9. Verify: ✓ Order shows "for_pick-up" status

## Benefits

✅ **Correct Data Structure** - Handling always has pickup and delivery objects with proper status
✅ **Unified Logic** - Frontend checks address consistently ("in-store" OR "store")
✅ **Automatic Handling** - Pickup auto-skipped, no manual intervention needed
✅ **Clear UX** - Only relevant phases shown to staff
✅ **POS-First Design** - Accounts for store-based operations (most common)
✅ **Mobile Support** - Both pickup and delivery work for delivery orders

## Files Modified

1. `src/app/api/orders/pos/create/route.ts` - Build handling structure for POS orders
2. `src/app/api/orders/mobile/create/route.ts` - Build handling structure for mobile orders
3. `src/app/in/baskets/page.tsx` - Updated timeline logic and rendering for "store"
4. `src/app/api/orders/[orderId]/basket/[basketNumber]/service/route.ts` - Auto-skip pickup for "store"

All changes maintain backward compatibility while fixing the data structure issues.
