# Phase 1.2: API Endpoints - Fresh Implementation

**Date:** January 26, 2026  
**Status:** ✅ Complete

---

## Overview

Built 7 brand-new Phase 1.2 API endpoints under `/api/pos/` namespace using the existing Supabase SSR auth patterns and the fresh database schema.

**Key Points:**

- ✅ No legacy code reused
- ✅ Uses `createClient()` from existing `src/app/utils/supabase/server.ts`
- ✅ Leverages existing Supabase auth (getClaims, getUser, etc.)
- ✅ Unified `order_data` JSONB structure
- ✅ Proper error handling with HTTP status codes
- ✅ Transactional order creation (all-or-nothing)

---

## Endpoints

### Public Endpoints (No Auth Required)

#### 1. `GET /api/pos/services`

Returns all active services with pricing, tiers, and modifiers.

**File:** `src/app/api/pos/services/route.ts`

**Response:**

```json
{
  "success": true,
  "services": [
    {
      "id": "uuid",
      "service_type": "wash|dry|spin|iron|staff_service|pickup|delivery",
      "name": "Wash Basic",
      "tier": "basic|premium|null",
      "base_price": 65.0,
      "base_duration_minutes": 39,
      "modifiers": {
        /* admin-configurable */
      },
      "is_active": true,
      "sort_order": 10
    }
  ]
}
```

---

#### 2. `GET /api/pos/products`

Returns all active products with pagination support.

**File:** `src/app/api/pos/products/route.ts`

**Query Params:**

- `limit` (default: 100, max: 500)
- `offset` (default: 0)

**Response:**

```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "sku": "PLASTIC_BAG_001",
      "item_name": "Plastic Bag",
      "unit_price": 3.0,
      "unit_cost": 0.5,
      "unit": "piece",
      "quantity": 100,
      "reorder_level": 20,
      "is_active": true,
      "sort_order": 10
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

---

#### 3. `GET /api/pos/customers/search`

Search customers by name or phone (case-insensitive).

**File:** `src/app/api/pos/customers/search/route.ts`

**Query Params:**

- `query` (required, min 2 chars)
- `limit` (default: 10, max: 100)

**Response:**

```json
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "phone_number": "+639123456789",
      "email_address": "john@example.com",
      "loyalty_points": 25
    }
  ]
}
```

---

#### 4. `POST /api/pos/customers`

Create new customer or update existing.

**File:** `src/app/api/pos/customers/route.ts`

**Create Request:**

```json
{
  "id": null,
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+639123456789",
  "email_address": "john@example.com",
  "address": "123 Main St"
}
```

**Update Request:**

```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  ...
}
```

**Response:**

```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+639123456789",
    "loyalty_points": 0,
    "created_at": "2026-01-26T10:30:00Z",
    "updated_at": "2026-01-26T10:30:00Z"
  }
}
```

**Status Codes:**

- `201` - Created
- `200` - Updated
- `400` - Validation failed
- `404` - Customer not found (update)
- `409` - Phone number conflict
- `500` - Server error

---

### Protected Endpoints (Auth Required)

#### 5. `POST /api/pos/create`

**⚠️ REQUIRES VALID SUPABASE SESSION**

Main POS order creation. Transactional: creates customer (if needed), creates order, deducts inventory, awards loyalty points. All-or-nothing.

**File:** `src/app/api/pos/create/route.ts`

**Request:**

```json
{
  "customer": {
    "id": "uuid|null",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+639123456789",
    "email_address": "john@example.com",
    "address": "123 Main St"
  },
  "baskets": [
    {
      "basket_number": 1,
      "services": [
        {
          "service_id": "uuid",
          "service_type": "wash",
          "tier": "basic|premium|null",
          "service_name": "Wash Basic",
          "rate_per_unit": 65.0,
          "unit": "basket",
          "subtotal": 65.0
        }
      ]
    }
  ],
  "products": [
    {
      "product_id": "uuid",
      "product_name": "Plastic Bag",
      "quantity": 2,
      "unit_price": 3.0,
      "subtotal": 6.0
    }
  ],
  "handling": {
    "is_self_service": false,
    "delivery_selected": true,
    "delivery_address": "456 Oak Ave",
    "delivery_fee": 50.0
  },
  "payment": {
    "method": "cash|gcash",
    "amount_paid": 600.0,
    "gcash_reference": null
  },
  "summary": {
    "subtotal_products": 6.0,
    "subtotal_services": 145.0,
    "subtotal_before_fees": 151.0,
    "service_charge": 40.0,
    "delivery_fee": 50.0,
    "subtotal_before_discount": 241.0,
    "vat_rate": 0.12,
    "vat_amount": 27.0,
    "grand_total_before_discount": 241.0,
    "loyalty_discount_amount": 0.0,
    "loyalty_discount_percentage": 0,
    "loyalty_points_used": 0,
    "grand_total": 241.0
  },
  "loyalty": {
    "use_discount": false,
    "points_available": 0,
    "points_to_use": 0,
    "discount_amount": 0.0,
    "discount_percentage": 0
  }
}
```

**Response (Success):**

```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "source": "store",
    "customer_id": "uuid",
    "cashier_id": "uuid",
    "status": "processing",
    "total_amount": 241.0,
    "created_at": "2026-01-26T10:30:00Z"
  }
}
```

**Status Codes:**

- `201` - Order created
- `400` - Validation failed
- `401` - Not authenticated
- `404` - Customer/service/product not found
- `500` - Server error

**Transaction Steps:**

1. Verify user authenticated + get cashier_id
2. Validate request
3. Validate customer data
4. Validate baskets/products exist
5. Create/get customer
6. Validate services exist
7. Validate products stock
8. Create order with unified `order_data` JSONB
9. Deduct inventory for all products
10. Award loyalty points (if no discount used)
11. Return success

---

#### 6. `GET /api/pos/orders/:id`

**⚠️ REQUIRES VALID SUPABASE SESSION**

Retrieve order with all details, customer, and staff info.

**File:** `src/app/api/pos/orders/[id]/route.ts`

**Response:**

```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "source": "store",
    "customer_id": "uuid",
    "customer": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "phone_number": "+639123456789",
      "email_address": "john@example.com"
    },
    "cashier_id": "uuid",
    "cashier": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Smith"
    },
    "status": "processing",
    "total_amount": 241.0,
    "order_data": {
      /* Complete JSONB */
    },
    "cancellation": null,
    "created_at": "2026-01-26T10:30:00Z",
    "updated_at": "2026-01-26T10:30:00Z"
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Not authenticated
- `404` - Order not found
- `500` - Server error

---

#### 7. `POST /api/pos/orders/:id/cancel`

**⚠️ REQUIRES VALID SUPABASE SESSION**

Cancel order and restore all product inventory.

**File:** `src/app/api/pos/orders/[id]/cancel/route.ts`

**Request:**

```json
{
  "reason": "Customer requested cancellation"
}
```

**Response:**

```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "status": "cancelled",
    "cancellation": {
      "reason": "Customer requested cancellation",
      "cancelled_by": "uuid",
      "cancelled_at": "2026-01-26T11:00:00Z"
    }
  }
}
```

**Status Codes:**

- `200` - Cancelled
- `400` - Invalid state (already cancelled, already completed, missing reason)
- `401` - Not authenticated
- `404` - Order not found
- `500` - Server error

**Behavior:**

- Restores all product quantities from `order_data.products`
- Records cancellation with reason, user_id, timestamp
- Prevents cancellation of completed orders

---

## Architecture

### Auth Pattern (Using Existing Code)

All endpoints use `createClient()` from `src/app/utils/supabase/server.ts`:

```typescript
const supabase = await createClient();

// For protected endpoints
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();
if (!user) return 401;

// Get cashier ID from staff record
const { data: staffData } = await supabase
  .from("staff")
  .select("id")
  .eq("auth_id", user.id)
  .single();
```

No custom auth middleware - reuses existing Supabase patterns.

---

### Data Storage

Orders use unified `order_data` JSONB:

```json
{
  "baskets": [
    /* All basket data */
  ],
  "products": [
    /* All product items */
  ],
  "handling": {
    /* Delivery/pickup info */
  },
  "payment": {
    /* Payment details */
  },
  "summary": {
    /* Pricing summary */
  },
  "loyalty": {
    /* Loyalty discount info */
  },
  "audit_log": [
    /* Action history */
  ]
}
```

Single `cancellation` JSONB (only if cancelled):

```json
{
  "reason": "...",
  "cancelled_by": "uuid",
  "cancelled_at": "timestamp"
}
```

---

### Error Handling

All endpoints return consistent format:

**Success:**

```json
{
  "success": true,
  "data": {}
}
```

**Error:**

```json
{
  "success": false,
  "error": "User-friendly message"
}
```

---

## Files Created

```
src/app/api/pos/
├── services/
│   └── route.ts                    ✅ GET services
├── products/
│   └── route.ts                    ✅ GET products
├── customers/
│   ├── route.ts                    ✅ POST customers (create/update)
│   └── search/
│       └── route.ts                ✅ GET search customers
├── create/
│   └── route.ts                    ✅ POST create order (transactional)
└── orders/
    └── [id]/
        ├── route.ts                ✅ GET order
        └── cancel/
            └── route.ts            ✅ POST cancel order
```

---

## Testing

Ready to test with curl/Postman:

**Get Services:**

```bash
curl http://localhost:3000/api/pos/services
```

**Search Customers:**

```bash
curl "http://localhost:3000/api/pos/customers/search?query=john&limit=10"
```

**Create Customer:**

```bash
curl -X POST http://localhost:3000/api/pos/customers \
  -H "Content-Type: application/json" \
  -d '{"first_name":"John","last_name":"Doe","phone_number":"+639123456789"}'
```

**Create Order (requires auth - test in app):**

```bash
# Must have valid Supabase session cookie
curl -X POST http://localhost:3000/api/pos/create \
  -H "Content-Type: application/json" \
  -d '{...order data...}'
```

---

## Next Steps

1. **Test endpoints** in Supabase/app environment
2. **Build Phase 2** - UI components to call these APIs
3. **Build Phase 3** - Additional features (service status updates, etc.)

---

**Status:** Phase 1.2 Complete ✅

Fresh, clean, no legacy code. Ready for UI integration.
