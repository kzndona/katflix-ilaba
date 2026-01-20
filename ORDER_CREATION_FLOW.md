# Order Creation Flow - SIMPLIFIED

## Single Unified Endpoint

**Everything goes through:**
```
POST /api/orders/transactional-create
```

Both POS and Mobile app use the **SAME endpoint** with their respective payload formats.

---

## POS Payload Format

```json
POST /api/orders/transactional-create

{
  "customer": {
    "id": "customer-uuid",
    "phone_number": "+639123456789",
    "email_address": "customer@example.com"
  },
  "orderPayload": {
    "source": "store",
    "customer_id": "customer-uuid",
    "cashier_id": "staff-uuid",
    "status": "processing",
    "total_amount": 500,
    "breakdown": { ...JSONB breakdown object... },
    "handling": { ...JSONB handling object... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "order-uuid",
  "order": { ...order details... }
}
```

---

## Mobile App Payload Format

```json
POST /api/orders/transactional-create

{
  "customer_id": "customer-uuid",
  "phone_number": "+639123456789",
  "email_address": "customer@example.com",
  "total": 230.0,
  "baskets": [
    {
      "weight": 8.0,
      "subtotal": 140.0,
      "notes": "Delicate items",
      "services": [
        {
          "service_id": "svc-uuid",
          "rate": 8.75,
          "subtotal": 70.0
        }
      ]
    }
  ],
  "products": [
    {
      "product_id": "prod-uuid",
      "quantity": 2,
      "unit_price": 45.0,
      "subtotal": 90.0
    }
  ],
  "payments": [
    {
      "amount": 230.0,
      "method": "gcash",
      "reference": "gcash-receipt-id"
    }
  ],
  "source": "mobile"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "order-uuid"
}
```

---

## How It Works

1. **Receive request** at `/api/orders/transactional-create`
2. **Detect format**:
   - If has `customer` + `orderPayload` → POS format
   - If has `customer_id` + `baskets`/`products` → Mobile format
3. **Update customer** phone/email in database
4. **Call `/api/orders`** with the order payload
5. **`/api/orders` handles**:
   - JSONB format (POS) → stores as-is with breakdown + handling
   - Array format (Mobile) → creates separate baskets, services, products, inventory deduction
6. **Return success** with orderId

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  POST /api/orders/transactional-create                       │
│                                                              │
│  ┌─────────────────────┐      ┌─────────────────────────┐   │
│  │ POS Format          │      │ Mobile Format           │   │
│  ├─────────────────────┤      ├─────────────────────────┤   │
│  │ customer: {...}     │      │ customer_id: "..."      │   │
│  │ orderPayload: {     │      │ baskets: [...]          │   │
│  │   breakdown: {...}  │      │ products: [...]         │   │
│  │   handling: {...}   │      │ payments: [...]         │   │
│  │ }                   │      │ source: "mobile"        │   │
│  └──────────┬──────────┘      └──────────┬──────────────┘   │
│             │                            │                  │
│             └────────────┬───────────────┘                  │
│                          ↓                                  │
│         1. Update customer (phone, email)                   │
│         2. Convert mobile format if needed                  │
│         3. Call /api/orders                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────────────────────┐
            │   POST /api/orders          │
            │                             │
            │  Handles both formats:      │
            │  - JSONB (POS)              │
            │  - Arrays (Mobile)          │
            │                             │
            │  Manages inventory,         │
            │  deduction, payments        │
            └──────────┬──────────────────┘
                       ↓
        ┌──────────────────────────────────┐
        │  Database                        │
        ├──────────────────────────────────┤
        │ orders (with breakdown/handling) │
        │ baskets (if mobile)              │
        │ basket_services (if mobile)      │
        │ order_products (if mobile)       │
        │ products (inventory updated)     │
        │ payments                         │
        └──────────────────────────────────┘
```

---

## Why One Endpoint?

✅ **Simplicity**: One endpoint to understand, document, test  
✅ **POS Priority**: Uses existing POS format  
✅ **Mobile Compatibility**: Mobile app just sends arrays, conversion handled internally  
✅ **Maintainability**: All logic in one place  
✅ **Future-proof**: Easy to add more formats if needed  

---

## Error Handling

All errors return this format:

```json
{
  "success": false,
  "error": "User-friendly error message",
  "partialSuccess": false,  // true if customer updated but order failed
  "debugInfo": { ... }      // Debug details if needed
}
```

**Common errors:**
- `400`: Missing customer_id or invalid format
- `404`: Customer not found  
- `500`: Database error, inventory issue, etc.

---

## Deprecation Notice

**OLD ENDPOINTS** (do not use):
- ❌ `/api/pos/newOrder` - deprecated, use `/api/orders/transactional-create` instead

---

## Implementation Checklist for Mobile App

- [ ] Prepare `customer_id` (UUID of existing customer)
- [ ] Prepare `phone_number` (for updates)
- [ ] Prepare `email_address` (for updates)
- [ ] Build baskets array with weight, services
- [ ] Build products array with quantities
- [ ] Build payments array with GCash reference
- [ ] POST to `/api/orders/transactional-create`
- [ ] Check response for `success: true` and `orderId`
- [ ] Handle errors with `error` field


