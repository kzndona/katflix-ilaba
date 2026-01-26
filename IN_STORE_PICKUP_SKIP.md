# In-Store Pickup Skip Feature

## Feature Description
When an order's pickup address is set to "In-store", the pickup phase is automatically skipped. The order proceeds directly from pending to basket services without requiring a pickup action.

## Implementation

### 1. Timeline Logic Skip
**File: `src/app/in/baskets/page.tsx`**

Updated `getTimelineNextAction()` function:
- Check if `order.handling.pickup.address` is "In-store" (case-insensitive)
- If In-store, skip the pickup phase entirely
- Go directly to basket services

```typescript
const isInStorePickup = order.handling.pickup.address?.toLowerCase() === "in-store";

// Skip pickup actions if In-store
if (!isInStorePickup && order.handling.pickup.status === "pending") {
  return { label: "Start Pickup", ... };
}
```

### 2. Timeline Rendering Skip
**File: `src/app/in/baskets/page.tsx`**

Updated pickup timeline rendering:
- Prevent pickup phase from displaying if address is "In-store"
- Only render services and delivery phases

```tsx
{/* PICKUP - Skip if address is "In-store" */}
{order.handling?.pickup &&
  order.handling.pickup.address?.toLowerCase() !== "in-store" &&
  (order.handling.pickup.status === "pending" || ...) && (
    <div>...</div>
)}
```

### 3. Auto-Skip Pickup on Service Start
**File: `src/app/api/orders/[orderId]/basket/[basketNumber]/service/route.ts`**

Added logic at the start of service update:
- Fetch the order's handling data
- If pickup address is "In-store" AND pickup status is "pending"
- Automatically mark pickup as "skipped" with completion timestamp
- Update the order's handling JSONB in database

```typescript
const isInStorePickup = order.handling?.pickup?.address?.toLowerCase() === "in-store";
if (isInStorePickup && order.handling?.pickup?.status === "pending") {
  const updatedHandling = {
    ...order.handling,
    pickup: {
      ...order.handling.pickup,
      status: "skipped",
      completed_at: new Date().toISOString(),
    },
  };
  
  await supabase
    .from("orders")
    .update({ handling: updatedHandling })
    .eq("id", orderId);
}
```

## Data Structure

### Before (In-store orders)
```json
{
  "handling": {
    "pickup": {
      "address": "In-store",
      "status": "pending",
      "started_at": null,
      "completed_at": null
    },
    "delivery": {
      "address": "...",
      "status": "pending"
    }
  }
}
```

### After (When service starts)
```json
{
  "handling": {
    "pickup": {
      "address": "In-store",
      "status": "skipped",
      "completed_at": "2026-01-27T..."
    },
    "delivery": {
      "address": "...",
      "status": "pending"
    }
  }
}
```

## Order Status Progression

### Delivery Address Orders (Normal Flow)
```
pending → processing → for_pick-up → processing → completed
         (service)    (all done)    (delivery)     (delivered)
```

### In-Store Orders (Optimized Flow)
```
pending → processing → for_pick-up → completed
         (service)    (all done)    (customer picks up)
```

The pickup phase is completely skipped for In-store orders:
- No "Start Pickup" button shown
- No "Complete Pickup" button shown
- Pickup automatically marked as "skipped"
- Services start immediately and proceed to delivery

## Testing

To test the feature:

1. Create an order with pickup address set to "In-store"
2. Go to baskets page
3. Verify that:
   - ✓ Pickup phase is NOT shown in timeline
   - ✓ Only services and delivery are shown
   - ✓ "Start [Service]" button appears instead of "Start Pickup"
   - ✓ When service button is clicked, pickup is auto-marked as "skipped"
   - ✓ Order flows: pending → processing → for_pick-up → completed

## Benefits

✅ **Simplified Workflow** - In-store customers skip unnecessary pickup step
✅ **Accurate Timeline** - Only relevant phases shown
✅ **Automatic Handling** - No manual pickup marking needed
✅ **Flexible Address Options** - Works with any delivery address type
✅ **Clean UI** - Baskets page only shows applicable actions

## Address Matching

The feature checks if `pickup.address?.toLowerCase() === "in-store"`:
- Case-insensitive ("In-store", "IN-STORE", "in-store" all work)
- Exact match (no partial matches)
- Applied at both rendering and API levels
