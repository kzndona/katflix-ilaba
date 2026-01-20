# Mobile App Order Creation Payload

## Endpoint
```
POST /api/pos/newOrder
```

---

## Product-Only Order (Auto-completes)

**Use Case**: Customer buying retail items only (no laundry services)
- Auto status: `"completed"`
- No baskets needed

```json
{
  "customerId": "b82b2d06-d0fe-48cc-b03a-6c8fe9300935",
  "total": 250,
  "source": "mobile",
  "baskets": [],
  "products": [
    {
      "product_id": "prod-uuid-1",
      "quantity": 2,
      "unit_price": 100,
      "subtotal": 200
    },
    {
      "product_id": "prod-uuid-2",
      "quantity": 1,
      "unit_price": 50,
      "subtotal": 50
    }
  ],
  "payments": [
    {
      "amount": 250,
      "method": "gcash",
      "reference": "gcash-screenshot-id-or-url"
    }
  ]
}
```

---

## Laundry Service Order (Processing)

**Use Case**: Customer sending clothes for laundry with optional services
- Auto status: `"processing"` (requires service completion)
- Baskets required

```json
{
  "customerId": "b82b2d06-d0fe-48cc-b03a-6c8fe9300935",
  "total": 500,
  "source": "mobile",
  "baskets": [
    {
      "weight": 5.5,
      "notes": "Delicate items, handle with care",
      "subtotal": 300,
      "services": [
        {
          "service_id": "svc-wash-uuid",
          "rate": 50,
          "subtotal": 275
        }
      ]
    }
  ],
  "products": [],
  "payments": [
    {
      "amount": 500,
      "method": "gcash",
      "reference": "gcash-screenshot-ref"
    }
  ]
}
```

---

## Mixed Order (Products + Laundry)

**Use Case**: Customer buying products AND sending laundry
- Total: sum of products + baskets + shippingFee
- Auto status: `"processing"` (laundry services need completion)

```json
{
  "customerId": "b82b2d06-d0fe-48cc-b03a-6c8fe9300935",
  "total": 750,
  "source": "mobile",
  "pickupAddress": "123 Main Street, City, 12345",
  "deliveryAddress": null,
  "shippingFee": 50,
  "baskets": [
    {
      "weight": 3.2,
      "notes": "Wedding dress - iron gently",
      "subtotal": 200,
      "services": [
        {
          "service_id": "svc-wash-uuid",
          "rate": 50,
          "subtotal": 180
        },
        {
          "service_id": "svc-dry-clean-uuid",
          "rate": 80,
          "subtotal": 20
        }
      ]
    }
  ],
  "products": [
    {
      "product_id": "prod-uuid-hangers",
      "quantity": 5,
      "unit_price": 100,
      "subtotal": 500
    }
  ],
  "payments": [
    {
      "amount": 750,
      "method": "gcash",
      "reference": "gcash-ref-12345"
    }
  ]
}
```

---

## Multiple Baskets Example

**Use Case**: Customer dropping off 2 separate laundry loads with different services

```json
{
  "customerId": "b82b2d06-d0fe-48cc-b03a-6c8fe9300935",
  "total": 800,
  "source": "mobile",
  "baskets": [
    {
      "weight": 4.0,
      "notes": "Regular clothes",
      "subtotal": 300,
      "services": [
        {
          "service_id": "svc-wash-uuid",
          "rate": 50,
          "subtotal": 300
        }
      ]
    },
    {
      "weight": 2.5,
      "notes": "Formal wear",
      "subtotal": 500,
      "services": [
        {
          "service_id": "svc-dry-clean-uuid",
          "rate": 80,
          "subtotal": 500
        }
      ]
    }
  ],
  "products": [],
  "payments": [
    {
      "amount": 800,
      "method": "gcash",
      "reference": "gcash-ref-multi-basket"
    }
  ]
}
```

---

## Field Reference

### Root Level
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | UUID string | ✅ Yes | Customer ID in the system |
| `total` | number | ✅ Yes | Total amount (sum of all subtotals + shipping) |
| `source` | "pos" \| "mobile" | ❌ No | Defaults to "mobile" |
| `baskets` | array | ✅ Yes | Empty array for product-only, or array of basket objects |
| `products` | array | ✅ Yes | Empty array if no products, or array of product objects |
| `payments` | array | ❌ No | Array of payment objects |
| `pickupAddress` | string | ❌ No | Delivery pickup address |
| `deliveryAddress` | string | ❌ No | Delivery address |
| `shippingFee` | number | ❌ No | Shipping cost (defaults to 0) |

### Basket Object
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `weight` | number | ❌ No | Weight in kg |
| `notes` | string | ❌ No | Special handling notes |
| `subtotal` | number | ✅ Yes | Sum of all services in this basket |
| `services` | array | ❌ No | Array of service objects |

### Service Object
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_id` | UUID string | ✅ Yes | Service ID (wash, dry-clean, etc.) |
| `rate` | number | ✅ Yes | Service rate/price per unit |
| `subtotal` | number | ✅ Yes | Service total cost |

### Product Object
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | UUID string | ✅ Yes | Product ID |
| `quantity` | number | ✅ Yes | Quantity ordered |
| `unit_price` | number | ✅ Yes | Price per unit |
| `subtotal` | number | ✅ Yes | quantity × unit_price |

### Payment Object
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | ✅ Yes | Payment amount |
| `method` | string | ✅ Yes | Payment method (e.g., "gcash") |
| `reference` | string | ❌ No | Payment reference (screenshot ID, transaction ID) |

---

## Order Status Logic

| Condition | Auto Status | Notes |
|-----------|-------------|-------|
| `baskets.length === 0` | `"completed"` | Product-only orders auto-complete |
| `baskets.length > 0` | `"processing"` | Laundry orders stay in processing until services complete |
| `pickupAddress` exists | `"pick-up"` | Overrides processing if baskets exist |

---

## Response

### Success (200)
```json
{
  "success": true,
  "orderId": "order-uuid-here"
}
```

### Error (500)
```json
{
  "success": false,
  "error": "Insufficient stock for Product Name. Available: 2, Requested: 5"
}
```

---

## Validation Rules

- ✅ `customerId` must be valid UUID
- ✅ `total` must match sum of subtotals + shippingFee
- ✅ Each product subtotal = quantity × unit_price
- ✅ Basket subtotal = sum of service subtotals
- ✅ Inventory is automatically deducted (check availability first)
- ✅ Empty baskets (weight = 0) should be filtered client-side
- ✅ All product/service IDs must exist in database

---

## Common Errors

| Error | Solution |
|-------|----------|
| "Insufficient stock for X" | Check available inventory, reduce quantity |
| "Order insertion failed" | Verify customerId exists and is valid UUID |
| "Basket insertion failed" | Ensure all baskets have subtotal and services array |
| "Failed to insert order_products" | Check product_id exists in database |

---

## Testing Checklist

- [ ] Send product-only order → verify status = "completed"
- [ ] Send laundry order → verify status = "processing"
- [ ] Send mixed order → verify both created correctly
- [ ] Check inventory deducted from products table
- [ ] Verify baskets created with correct services
- [ ] Test with insufficient stock → expect error
- [ ] Verify payments recorded (if included)
- [ ] Test pickup address → status changes to "pick-up"
