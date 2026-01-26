# Phase 1.2: API Specification Document

**Date:** January 26, 2026  
**Status:** Ready for Review

---

## Overview

This document defines all new/modified API endpoints for the POS overhaul. The new POS uses a single transactional endpoint with supporting endpoints for data retrieval.

---

## Core Principles

1. **Single Endpoint for Order Creation**: `POST /api/orders/pos/create`
2. **Database Transaction**: All-or-nothing (rollback on any failure)
3. **Error Handling**: Comprehensive with user-friendly messages
4. **Data Validation**: Server-side validation of all inputs
5. **Idempotency**: Safe to retry failed requests

---

## Endpoints

### 1. GET /api/services

**Purpose:** Retrieve all active services with pricing and duration

**Method:** `GET`

**Response:**

```typescript
{
  "success": true,
  "services": [
    {
      "id": "uuid",
      "service_type": "wash",
      "name": "Wash Basic",
      "tier": "basic",
      "description": "Triple rinse",
      "rate_per_unit": 65.00,
      "unit": "basket",
      "base_duration_minutes": 39,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "wash",
      "name": "Wash Premium",
      "tier": "premium",
      "description": "Double rinse",
      "rate_per_unit": 80.00,
      "unit": "basket",
      "base_duration_minutes": 33,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "dry",
      "name": "Dry Basic",
      "tier": "basic",
      "description": null,
      "rate_per_unit": 65.00,
      "unit": "basket",
      "base_duration_minutes": 40,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "dry",
      "name": "Dry Premium",
      "tier": "premium",
      "description": null,
      "rate_per_unit": 80.00,
      "unit": "basket",
      "base_duration_minutes": 32,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "spin",
      "name": "Spin",
      "tier": null,
      "description": null,
      "rate_per_unit": 20.00,
      "unit": "basket",
      "base_duration_minutes": 10,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "iron",
      "name": "Iron",
      "tier": null,
      "description": null,
      "rate_per_unit": 80.00,
      "unit": "kg",
      "base_duration_minutes": null,
      "is_active": true
    },
    {
      "id": "uuid",
      "service_type": "pickup",
      "name": "Additional Dry Time",
      "tier": null,
      "description": null,
      "rate_per_unit": 15.00,
      "unit": "increment",
      "base_duration_minutes": 8,
      "is_active": true
    }
  ]
}
```

**Errors:**

- `500`: Database error

---

### 2. GET /api/products

**Purpose:** Retrieve all active products with stock and pricing

**Method:** `GET`

**Query Parameters:**

- `limit` (optional): Number of products to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**

```typescript
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "item_name": "Plastic Bag",
      "unit_price": 3.00,
      "unit_cost": 0.50,
      "quantity": 500,
      "reorder_level": 100,
      "is_active": true,
      "image_url": "https://...",
      "image_alt_text": "Laundry plastic bag",
      "created_at": "2026-01-01T00:00:00Z",
      "last_updated": "2026-01-26T00:00:00Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Errors:**

- `500`: Database error

---

### 3. GET /api/customers/search

**Purpose:** Search for customers by name or phone (debounced)

**Method:** `GET`

**Query Parameters:**

- `query` (required): Search term (min 2 characters)
- `limit` (optional): Max results to return (default: 10)

**Response:**

```typescript
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "first_name": "John",
      "middle_name": "Paul",
      "last_name": "Doe",
      "phone_number": "+639123456789",
      "email_address": "john@example.com",
      "address": "123 Main St",
      "loyalty_points": 25,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:**

- `400`: Query < 2 characters
- `500`: Database error

---

### 4. POST /api/customers

**Purpose:** Create or update customer

**Method:** `POST`

**Request Body:**

```typescript
{
  "id": "uuid" | null,  // null = create, uuid = update
  "first_name": "John",
  "middle_name": "Paul" | null,
  "last_name": "Doe",
  "phone_number": "+639123456789",
  "email_address": "john@example.com" | null,
  "address": "123 Main St" | null,
  "birthdate": "1990-01-01" | null,
  "gender": "male" | "female" | "other" | null
}
```

**Response:**

```typescript
{
  "success": true,
  "customer": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+639123456789",
    "email_address": "john@example.com",
    "loyalty_points": 0,
    "created_at": "2026-01-26T10:30:00Z",
    "updated_at": "2026-01-26T10:30:00Z"
  }
}
```

**Errors:**

- `400`: Missing required fields (first_name, last_name, phone_number)
- `400`: Invalid phone format
- `400`: Invalid email format
- `409`: Phone number already exists (different customer)
- `404`: Customer not found (update case)
- `500`: Database error

---

### 5. POST /api/orders/pos/create

**Purpose:** Create order with all details (main POS endpoint)

**Method:** `POST`

**Request Body:**

```typescript
{
  // Customer info
  "customer": {
    "id": "uuid" | null,           // null = create new, uuid = existing
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+639123456789",
    "email_address": "john@example.com" | null,
    "address": null
  },

  // Order items
  "baskets": [
    {
      "basket_number": 1,
      "services": [
        {
          "service_id": "uuid",
          "service_type": "wash",
          "tier": "basic" | "premium" | null,
          "service_name": "Wash Basic",
          "rate_per_unit": 65.00,
          "unit": "basket",
          "subtotal": 65.00
        },
        {
          "service_id": "uuid",
          "service_type": "dry",
          "tier": "basic" | "premium" | null,
          "service_name": "Dry Premium",
          "rate_per_unit": 80.00,
          "unit": "basket",
          "subtotal": 80.00
        },
        {
          "service_id": "uuid",
          "service_type": "spin",
          "service_name": "Spin",
          "rate_per_unit": 20.00,
          "unit": "basket",
          "subtotal": 20.00
        },
        {
          "service_id": "uuid",
          "service_type": "iron",
          "service_name": "Iron",
          "rate_per_unit": 80.00,
          "unit": "kg",
          "weight_kg": 3,
          "subtotal": 240.00
        }
      ]
    }
  ],

  "products": [
    {
      "product_id": "uuid",
      "product_name": "Plastic Bag",
      "quantity": 2,
      "unit_price": 3.00,
      "subtotal": 6.00
    }
  ],

  // Handling & delivery
  "handling": {
    "is_self_service": false,
    "pickup_selected": false,
    "pickup_address": null,
    "delivery_selected": true,
    "delivery_address": "456 Oak Ave",
    "delivery_fee": 50.00,
    "delivery_fee_override": null,  // null = use default
    "special_instructions": "Leave at door"
  },

  // Payment
  "payment": {
    "method": "cash" | "gcash",
    "amount_paid": 600.00,  // For cash only
    "gcash_reference": null  // For GCash only
  },

  // Pricing summary
  "summary": {
    "subtotal_products": 6.00,
    "subtotal_services": 405.00,
    "subtotal_before_fees": 411.00,
    "service_charge": 40.00,          // If is_staff_service = true
    "delivery_fee": 50.00,
    "subtotal_before_discount": 501.00,
    "vat_rate": 0.12,
    "vat_amount": 56.25,
    "grand_total_before_discount": 501.00,
    "loyalty_discount_amount": 0.00,
    "loyalty_discount_percentage": 0,
    "loyalty_points_used": 0,
    "grand_total": 501.00
  },

  // Loyalty
  "loyalty": {
    "use_discount": false,
    "points_available": 0,
    "points_to_use": 0,
    "discount_amount": 0.00,
    "discount_percentage": 0
  }
}
```

**Response (Success):**

```typescript
{
  "success": true,
  "order": {
    "id": "uuid",
    "source": "store",
    "customer_id": "uuid",
    "cashier_id": "uuid",
    "status": "processing",
    "total_amount": 501.00,
    "breakdown": { /* Full JSONB */ },
    "handling": { /* Full JSONB */ },
    "created_at": "2026-01-26T10:30:00Z"
  },
  "receipt": {
    "plaintext": "...",
    "html": "..."
  }
}
```

**Response (Error - Validation):**

```typescript
{
  "success": false,
  "error": "User-friendly error message",
  "details": {
    "field": "baskets",
    "reason": "At least one basket required"
  }
}
```

**Validation Rules:**

- Customer: first_name, last_name, phone_number required
- Baskets: At least one required (if not self-service)
- Services: Valid service_id, tier, rate_per_unit
- Iron: weight_kg between 2 and 8
- Products: Valid product_id, sufficient stock
- Handling: Valid address if delivery selected
- Payment: amount_paid >= grand_total (cash), reference provided (GCash)
- Summary: Matches calculated values (prevent client manipulation)

**Errors:**

- `400`: Validation failed (missing fields, invalid data)
- `400`: Insufficient product stock
- `400`: Invalid service/product IDs
- `404`: Customer not found (if customer.id provided)
- `404`: Service not found
- `404`: Product not found
- `409`: Conflict (e.g., customer phone already exists)
- `500`: Database transaction failed (rollback applied)

**Transaction Sequence:**

1. Validate all inputs
2. Create/update customer
3. Validate product stock
4. Create order
5. Deduct product inventory
6. Create product_transactions
7. Award loyalty points (if applicable)
8. Return order + receipt

---

### 6. GET /api/orders/:id

**Purpose:** Retrieve order with all details

**Method:** `GET`

**Response:**

```typescript
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
    "total_amount": 501.00,
    "breakdown": { /* Full JSONB */ },
    "handling": { /* Full JSONB */ },
    "created_at": "2026-01-26T10:30:00Z"
  }
}
```

**Errors:**

- `404`: Order not found
- `500`: Database error

---

### 7. PATCH /api/orders/:id/service-status

**Purpose:** Update service status during order processing

**Method:** `PATCH`

**Request Body:**

```typescript
{
  "basket_number": 1,
  "service_id": "uuid",
  "action": "start" | "complete" | "skip",
  "completed_by": "staff-uuid" | null
}
```

**Response:**

```typescript
{
  "success": true,
  "order": {
    "id": "uuid",
    "breakdown": { /* Updated JSONB */ },
    "status": "processing" | "completed"
  }
}
```

**Errors:**

- `400`: Invalid action
- `404`: Order not found
- `404`: Service not found
- `500`: Database error

---

### 8. POST /api/orders/:id/cancel

**Purpose:** Cancel order and restore inventory

**Method:** `POST`

**Request Body:**

```typescript
{
  "reason": "Customer request",
  "cancelled_by": "staff-uuid"
}
```

**Response:**

```typescript
{
  "success": true,
  "order": {
    "id": "uuid",
    "status": "cancelled",
    "cancellation": {
      "reason": "Customer request",
      "cancelled_by": "staff-uuid",
      "cancelled_at": "2026-01-26T10:35:00Z"
    }
  }
}
```

**Errors:**

- `400`: Already cancelled
- `400`: Already completed (can't cancel)
- `404`: Order not found
- `500`: Database error

---

### 9. GET /api/receipts/:order_id

**Purpose:** Retrieve order receipt

**Method:** `GET`

**Response:**

```typescript
{
  "success": true,
  "receipt": {
    "order_id": "uuid",
    "plaintext": "...",
    "html": "...",
    "generated_at": "2026-01-26T10:30:00Z"
  }
}
```

**Errors:**

- `404`: Order not found
- `500`: Generation error

---

### 10. POST /api/email/send-receipt

**Purpose:** Send receipt via email

**Method:** `POST`

**Request Body:**

```typescript
{
  "order_id": "uuid",
  "email": "john@example.com",
  "customer_name": "John Doe" | null
}
```

**Response:**

```typescript
{
  "success": true,
  "message": "Receipt sent successfully",
  "email": "john@example.com",
  "order_id": "uuid"
}
```

**Errors:**

- `400`: Invalid email
- `404`: Order not found
- `500`: Email send failed

---

## Error Response Format

All errors follow this format:

```typescript
{
  "success": false,
  "error": "User-friendly error message",
  "details": {
    "field": "fieldName",  // (optional) Which field caused error
    "reason": "Detailed reason",
    "code": "ERROR_CODE"   // (optional) Machine-readable error code
  }
}
```

---

## Transaction Handling

### POST /api/orders/pos/create - Transaction Flow

```
BEGIN TRANSACTION
  ├─ Validate all inputs
  │  ├─ Check customer data
  │  ├─ Check service data
  │  ├─ Check product stock
  │  └─ Check payment data
  │
  ├─ Create/Update customer
  │  └─ If new customer: insert
  │  └─ If existing: update phone/email
  │
  ├─ Create order
  │  └─ Insert with breakdown + handling JSONB
  │
  ├─ Deduct inventory
  │  └─ For each product: update quantity
  │
  ├─ Create product_transactions
  │  └─ Audit trail for inventory changes
  │
  └─ Award loyalty points
     └─ If no discount used: +1 point

COMMIT TRANSACTION

If any step fails:
  ROLLBACK TRANSACTION
  Return error response
```

---

## Rate Limiting

- Customer search: 500ms debounce (client-side)
- Product list: Cache for 1 hour (client-side)
- Services: Cache for 1 hour (client-side)
- Orders: No caching (real-time)

---

## Next Steps

1. **Review this API spec** - Does it match your vision?
2. **Approve it** - I'll implement the endpoints
3. **Move to Phase 2-3** - UI + API implementation (parallel)

---

**Ready to approve this API specification?**
