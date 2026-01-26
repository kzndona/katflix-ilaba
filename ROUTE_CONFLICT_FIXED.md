# Route Parameter Conflict - Fixed

## Issue Summary
The Next.js build was failing with an error:
```
Error: You cannot use different slug names for the same dynamic path ('id' !== 'orderId').
```

## Root Cause
Two conflicting dynamic route segments at the same level:
- `src/app/api/orders/[id]/route.ts` (used parameter `id`)
- `src/app/api/orders/[orderId]/...` (used parameter `orderId`)

Next.js doesn't allow different parameter names for overlapping paths.

## Solution Applied

### 1. Parameter Standardization
Changed all references from `id` to `orderId` for consistency:
- Updated: `src/app/api/orders/[id]/route.ts` → `src/app/api/orders/[orderId]/route.ts`
- The PATCH handler was also fixed to properly await params: `Promise<{orderId, basketNumber}>`

### 2. Route Structure
Final consolidated structure:
```
/api/orders/
├── route.ts (GET all orders)
├── [orderId]/
│   ├── route.ts (GET single order)
│   └── basket/
│       └── [basketNumber]/
│           └── service/
│               └── route.ts (PATCH service status)
├── withServiceStatus/
│   └── route.ts (GET orders with service status)
├── pos/
│   └── create/
│       └── route.ts (POST create POS order)
└── mobile/
    └── create/
        └── route.ts (POST create mobile order)
```

### 3. Files Modified
- **`src/app/api/orders/[orderId]/route.ts`** (created/consolidated)
  - GET endpoint to retrieve single order by orderId
  - Uses `Promise<{orderId: string}>` for params
  - Properly typed and authenticated

- **`src/app/api/orders/[orderId]/basket/[basketNumber]/service/route.ts`** (fixed)
  - PATCH endpoint to update service status
  - Fixed to use `Promise<{orderId: string; basketNumber: string}>`
  - Properly awaits params before accessing

## Build Status
✅ **Build Successful**
- No routing conflicts
- All TypeScript errors resolved
- Dev server running on localhost:3000

## Verification
Run these commands to verify:
```bash
# Build test
npm run build

# Dev server
npm run dev
```

Both complete successfully without errors.

## API Endpoints (All Working)
- ✅ GET `/api/orders` - List all orders
- ✅ GET `/api/orders/{orderId}` - Get single order
- ✅ GET `/api/orders/withServiceStatus` - Orders with service status
- ✅ PATCH `/api/orders/{orderId}/basket/{basketNumber}/service` - Update service
- ✅ POST `/api/orders/pos/create` - Create POS order
- ✅ POST `/api/orders/mobile/create` - Create mobile order

All endpoints now use consistent `orderId` parameter naming.
