# Developer Quick Reference - Simplified Schema (v2)

**Quick lookup for building order-related features with 8-table schema**

---

## 📦 Products Table Usage

### Creating a Product
```typescript
// Only 4 fields to set
INSERT INTO products (item_name, unit_price, reorder_level, is_active)
VALUES ('Detergent', 150.00, 10, true);

// quantity ALWAYS starts at 0
// NEVER manually update quantity column
// ALL changes go through product_transactions table
```

### Product Adjustments
```typescript
// Stock received from supplier
INSERT INTO product_transactions (product_id, change_type, quantity, reason, staff_id)
VALUES (product_uuid, 'add', 100, 'Supplier delivery', staff_uuid);
UPDATE products SET quantity = quantity + 100 WHERE id = product_uuid;

// Stock lost/damaged
INSERT INTO product_transactions (product_id, change_type, quantity, reason, staff_id)
VALUES (product_uuid, 'remove', 5, 'Damaged in storage', staff_uuid);
UPDATE products SET quantity = quantity - 5 WHERE id = product_uuid;

// Manual inventory correction
INSERT INTO product_transactions (product_id, change_type, quantity, reason, staff_id)
VALUES (product_uuid, 'adjust', 3, 'Physical count discrepancy', staff_uuid);
UPDATE products SET quantity = quantity + 3 WHERE id = product_uuid;  -- or - depending on correction
```

### Track Consumption on Order
```typescript
// When order completes
INSERT INTO product_transactions (product_id, change_type, quantity, reason, order_id)
VALUES (product_uuid, 'consume', 5, 'Order completed', order_uuid);
UPDATE products SET quantity = quantity - 5 WHERE id = product_uuid;
```

### Query Product Audit Trail
```sql
-- All changes to a product
SELECT * FROM product_transactions 
WHERE product_id = 'product-uuid'
ORDER BY created_at DESC;

-- Changes by type
SELECT change_type, SUM(quantity) as total FROM product_transactions 
WHERE product_id = 'product-uuid'
GROUP BY change_type;

-- Orders that consumed stock
SELECT DISTINCT order_id FROM product_transactions 
WHERE product_id = 'product-uuid' AND change_type = 'consume'
ORDER BY created_at DESC;
```

---

## 📦 Order Creation Example

```typescript
// Create new order with complete breakdown
const order = {
  source: "store",  // or "app"
  customer_id: "uuid-xxx",
  cashier_id: "uuid-yyy",  // null for mobile
  total_amount: 1500.00,
  order_note: "VIP customer - priority",
  
  handling: {
    pickup: {
      address: "123 Main St",
      latitude: 14.5995,
      longitude: 120.9842,
      status: "pending",
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null
    },
    delivery: {
      address: "456 Oak Ave",
      latitude: 14.6091,
      longitude: 120.9824,
      status: "pending",
      started_at: null,
      completed_at: null,
      completed_by: null,
      duration_in_minutes: null
    }
  },
  
  breakdown: {
    items: [
      {
        id: "uuid-item-1",
        product_id: "uuid-prod-1",
        product_name: "Detergent",
        quantity: 2,
        unit_price: 150,
        subtotal: 300,
        discount: null
      }
    ],
    
    baskets: [
      {
        basket_number: 1,
        weight: 5.0,
        basket_notes: "Delicate fabrics",
        services: [
          {
            id: "uuid-svc-1",
            service_id: "uuid-wash",
            service_name: "Wash",
            is_premium: false,
            multiplier: 1,
            rate_per_kg: 50,
            subtotal: 250,
            status: "pending",
            started_at: null,
            completed_at: null,
            completed_by: null,
            duration_in_minutes: null
          }
        ],
        total: 250
      }
    ],
    
    fees: [
      {
        id: "uuid-fee-1",
        type: "handling_fee",
        description: "Delivery fee",
        amount: 100
      }
    ],
    
    discounts: [
      {
        id: "uuid-disc-1",
        type: "loyalty",
        applied_to: "order_total",
        value_type: "percentage",
        value: 10,
        reason: "Loyalty member",
        applied_amount: 155
      }
    ],
    
    summary: {
      subtotal_products: 300,
      subtotal_services: 250,
      handling: 100,
      service_fee: 0,
      discounts: 155,
      vat_rate: 0.12,
      vat_amount: 180,
      vat_model: "inclusive",
      grand_total: 1500
    },
    
    payment: {
      method: "cash",
      amount_paid: 1500,
      change: 0,
      reference_number: null,
      payment_status: "successful",
      completed_at: "2025-12-17T10:30:00Z"
    }
  },
  
  cancellation: null  // null unless cancelled
}
```

---

## 🔍 Query Examples

### Find all store orders from today
```sql
SELECT * FROM orders 
WHERE source = 'store' 
  AND DATE(created_at) = CURRENT_DATE;
```

### Find orders pending approval (mobile)
```sql
SELECT * FROM orders 
WHERE source = 'app' 
  AND status = 'pending' 
  AND approved_at IS NULL;
```

### Find high-value orders
```sql
SELECT id, customer_id, total_amount, created_at FROM orders 
WHERE total_amount > 5000 
ORDER BY total_amount DESC;
```

### Get order with all details
```sql
SELECT 
  id, customer_id, status, total_amount, created_at,
  breakdown ->> 'summary' as summary_data,
  handling ->> 'pickup' as pickup_info,
  handling ->> 'delivery' as delivery_info
FROM orders
WHERE id = 'order-uuid';
```

### Check service completion status
```sql
SELECT 
  o.id,
  o.status,
  jsonb_array_length(o.breakdown -> 'baskets' -> 0 -> 'services') as service_count,
  o.breakdown -> 'baskets' -> 0 -> 'services' ->> 'status' as first_service_status
FROM orders o
WHERE o.id = 'order-uuid';
```

### Find orders by customer
```sql
SELECT * FROM orders 
WHERE customer_id = 'customer-uuid'
ORDER BY created_at DESC
LIMIT 10;
```

### Calculate daily revenue
```sql
SELECT 
  DATE(created_at) as order_date,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue
FROM orders
WHERE source = 'store'
  AND status IN ('completed', 'for_delivery')
GROUP BY DATE(created_at)
ORDER BY order_date DESC;
```

### Find incomplete orders
```sql
SELECT * FROM orders
WHERE status NOT IN ('completed', 'cancelled')
ORDER BY created_at ASC;
```

### Product inventory audit
```sql
-- Current quantity vs transactions
SELECT 
  p.id,
  p.item_name,
  p.quantity as current_quantity,
  COUNT(pt.id) as total_transactions,
  SUM(CASE WHEN pt.change_type = 'add' THEN pt.quantity ELSE 0 END) as total_added,
  SUM(CASE WHEN pt.change_type = 'consume' THEN pt.quantity ELSE 0 END) as total_consumed
FROM products p
LEFT JOIN product_transactions pt ON p.id = pt.product_id
GROUP BY p.id, p.item_name, p.quantity
ORDER BY p.item_name;
```

---

## 🔄 Status Transitions

### Valid Status Flow
```
pending → for_pick-up → processing → for_delivery → completed
pending → cancelled (at any point)
processing → cancelled (at any point)
```

### Status Meaning
- **pending**: Awaiting approval (mobile) or first action
- **for_pick-up**: Customer needs to pick up
- **processing**: Service work in progress
- **for_delivery**: Ready for delivery
- **completed**: All done
- **cancelled**: Order cancelled

---

## 📝 Common API Operations

### Approve mobile order
```
POST /api/orders/{id}/approve
Body: { approved_by: staff_uuid }
Response: { approved_at: timestamp, status: "processing" }
```

### Start service
```
POST /api/orders/{id}/services/{service_id}/start
Body: { staff_id: uuid, machine_id?: uuid }
Response: { started_at: timestamp }
```

### Complete service
```
POST /api/orders/{id}/services/{service_id}/complete
Body: { staff_id: uuid, duration: minutes }
Response: { completed_at: timestamp }

// Then check if order should transition to completed
// If all services done + all handling done + payment successful:
//   Update orders.status = 'completed'
```

### Start fulfillment stage
```
POST /api/orders/{id}/handling/{stage}/start
Parameters: stage = "pickup" | "delivery"
Body: { staff_id: uuid }
Response: { started_at: timestamp }
```

### Complete fulfillment stage
```
POST /api/orders/{id}/handling/{stage}/complete
Parameters: stage = "pickup" | "delivery"
Body: { staff_id: uuid, duration: minutes }
Response: { completed_at: timestamp }

// Then check if should transition to next stage
// pickup complete → status = 'for_delivery'
// delivery complete + all services done → status = 'completed'
```

### Cancel order
```
POST /api/orders/{id}/cancel
Body: { reason: string, requested_by: uuid }
Response: { status: "cancelled", cancellation: {...} }
```

### Consume inventory on order completion
```
POST /api/orders/{id}/finalize
// When called:
// 1. For each product in breakdown.items:
//    INSERT INTO product_transactions (product_id, change_type='consume', quantity, order_id)
//    UPDATE products SET quantity = quantity - consumed_qty
// 2. Update order.status = 'completed'
```

---

## 🔐 Data Validation Rules

### On Order Creation
- ✅ customer_id must exist
- ✅ cashier_id (if provided) must exist
- ✅ total_amount > 0
- ✅ breakdown.payment.amount_paid >= total_amount (cash)
- ✅ all product_ids in breakdown.items must exist
- ✅ all service_ids in breakdown.baskets[].services[] must exist
- ✅ breakdown.summary.grand_total = total_amount

### On Status Update
- ✅ Only valid transitions allowed
- ✅ Cannot move to "completed" unless all conditions met
- ✅ Cannot move from "completed" to any other status
- ✅ Cannot move from "cancelled" to any other status

### On Service Completion
- ✅ Must have started_at before completed_at
- ✅ completed_by must be valid staff_id
- ✅ If all services completed/skipped, can mark basket complete
- ✅ If all baskets complete and handling complete, order complete

---

## 💾 Inventory Tracking Workflow

### On Order Completion
```typescript
// 1. Call finalize endpoint or trigger on status change
// 2. For each product in order.breakdown.items:

for (const item of order.breakdown.items) {
  // Create transaction record
  await db.insert(productTransactions).values({
    product_id: item.product_id,
    change_type: 'consume',
    quantity: item.quantity,
    reason: `Order ${order.id} completed`,
    order_id: order.id,
    staff_id: staff_id  // whoever triggered completion
  });
  
  // Update inventory
  await db.update(products)
    .set({ quantity: db.raw('quantity - ?', [item.quantity]) })
    .where(eq(products.id, item.product_id));
}
```

### Querying Product Consumption
```sql
-- How much of product was consumed by orders
SELECT 
  pt.product_id,
  p.item_name,
  COUNT(DISTINCT pt.order_id) as order_count,
  SUM(pt.quantity) as total_consumed,
  MIN(pt.created_at) as first_consumption,
  MAX(pt.created_at) as last_consumption
FROM product_transactions pt
JOIN products p ON p.id = pt.product_id
WHERE pt.change_type = 'consume'
GROUP BY pt.product_id, p.item_name
ORDER BY total_consumed DESC;
```

---

## 📊 Important Indexes

```sql
-- Query Performance
idx_orders_customer_id          -- Find customer's orders
idx_orders_status               -- Filter by status
idx_orders_created_at           -- Sort by date
idx_orders_total_amount         -- Range queries on amount
idx_orders_source               -- Filter store vs app

-- Product Transactions
idx_product_transactions_product_id     -- Product history
idx_product_transactions_order_id       -- Order inventory
idx_product_transactions_created_at     -- Timeline
idx_product_transactions_change_type    -- By transaction type
```

---

## 🔗 Foreign Key Constraints

```
orders.customer_id → customers(id)       [CASCADE on delete]
orders.cashier_id → staff(id)            [SET NULL on delete]
product_transactions.product_id → products(id)  [CASCADE on delete]
product_transactions.order_id → orders(id)     [CASCADE on delete]
product_transactions.staff_id → staff(id)      [SET NULL on delete]
issues.order_id → orders(id)             [CASCADE on delete]
issues.reported_by → staff(id)           [SET NULL on delete]
issues.resolved_by → staff(id)           [SET NULL on delete]
```

---

## ✅ Before Going Live

- [ ] Test product creation (4 fields only)
- [ ] Test product transaction logging
- [ ] Test order creation with full breakdown
- [ ] Test all status transitions
- [ ] Test inventory consumption workflow
- [ ] Test mobile approval workflow
- [ ] Verify product quantity audit trail
- [ ] Load test with 1000+ orders
- [ ] Backup database before migration
- [ ] Monitor performance post-launch

---

## 🎯 Key Differences from Old Schema

| Old | New | Benefit |
|-----|-----|---------|
| 12 tables | 8 tables | Simpler, faster queries |
| Separate product_logs + inventory_transactions | Unified product_transactions | One source of truth |
| Multiple status tables | Status in breakdown JSON | Immutable order snapshot |
| unit + unit_cost on products | Only unit_price | Simpler product management |
| Manual quantity edits | product_transactions required | Audit trail enforced |
| Service logs separate table | In breakdown.baskets[].services[] | Everything together |
| Order status history table | In breakdown JSON | Less table joins |

