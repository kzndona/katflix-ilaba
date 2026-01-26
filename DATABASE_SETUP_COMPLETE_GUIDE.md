# Database Tables Setup - Complete Order

## Step-by-Step Setup

### ⚠️ IMPORTANT: Create in this order!

1. **customers** (if not exists)
2. **products** (if not exists)
3. **orders** ← CREATE THIS FIRST
4. **product_transactions** ← CREATE THIS SECOND

---

## Step 1: Create Orders Table

**Location:** Supabase → SQL Editor → New Query

```sql
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  breakdown JSONB NOT NULL,
  handling JSONB NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_cashier_id ON orders(cashier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_breakdown_gin ON orders USING GIN (breakdown);
CREATE INDEX idx_orders_handling_gin ON orders USING GIN (handling);
CREATE INDEX idx_orders_payment_method ON orders USING GIN ((handling -> 'payment_method'));
CREATE INDEX idx_orders_delivery ON orders USING GIN ((handling -> 'handling_type'));
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at DESC);

COMMENT ON TABLE orders IS 'POS orders with laundry services (baskets) and product purchases';
COMMENT ON COLUMN orders.breakdown IS 'JSONB: {items, baskets, fees, summary}';
COMMENT ON COLUMN orders.handling IS 'JSONB: {service_type, handling_type, delivery_address, payment_method, ...}';
```

Click **Run** ▶️

---

## Step 2: Create Product Transactions Table

**Location:** Supabase → SQL Editor → New Query

```sql
CREATE TABLE IF NOT EXISTS product_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'adjustment',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_transaction_type CHECK (
    transaction_type IN ('order', 'adjustment', 'return', 'restock', 'damage')
  )
);

CREATE INDEX idx_product_transactions_product_id ON product_transactions(product_id);
CREATE INDEX idx_product_transactions_order_id ON product_transactions(order_id);
CREATE INDEX idx_product_transactions_created_at ON product_transactions(created_at DESC);
```

Click **Run** ▶️

---

## ✅ Verification

After creating both tables:

1. Go to **Table Editor**
2. You should see:
   - ✅ orders
   - ✅ product_transactions

3. Click each table to verify columns exist

---

## Table Structure Summary

### orders

```
id (UUID)
├─ customer_id → references customers
├─ cashier_id → references staff
├─ status: pending/processing/completed/cancelled
├─ breakdown: {
│   items: [{product_id, quantity, unit_price}],
│   baskets: [{wash, dry, spin, iron, additional_dry_time}],
│   fees: [{type, amount}],
│   summary: {subtotal, tax, total}
│ }
├─ handling: {
│   service_type: self_service/staff_service,
│   handling_type: pickup/delivery,
│   delivery_address: string,
│   payment_method: cash/gcash,
│   amount_paid: number
│ }
├─ total_amount: 0.00
└─ timestamps: created_at, updated_at, cancelled_at
```

### product_transactions

```
id (UUID)
├─ product_id → references products
├─ order_id → references orders (optional)
├─ quantity_change: integer (+ or -)
├─ transaction_type: order/adjustment/return/restock/damage
├─ notes: text
└─ created_at: timestamp
```

---

## What Each Field Means

### orders.breakdown

This JSONB contains **everything about the laundry order**:

- Which services (wash, dry, iron) per basket
- How many baskets
- What products ordered
- Final totals with fees and VAT

### orders.handling

This JSONB contains **how the order is handled**:

- Is it staff service or customer self-service?
- Is it pickup or delivery?
- What's the delivery address?
- How did they pay (cash/GCash)?
- How much they paid

### product_transactions

This table tracks **every inventory change**:

- When 5 items sold → `-5` quantity_change, type='order'
- When 50 items restocked → `+50` quantity_change, type='restock'
- When 3 items damaged → `-3` quantity_change, type='damage'

---

## Example Data

### Sample Order (breakdown JSONB)

```json
{
  "items": [
    {
      "product_id": "uuid-123",
      "product_name": "Plastic Bags",
      "quantity": 2,
      "unit_price": 5.0,
      "total_price": 10.0
    }
  ],
  "baskets": [
    {
      "basket_number": 1,
      "weight_kg": 6,
      "services": {
        "wash": "basic",
        "dry": "premium",
        "spin": true,
        "iron_weight_kg": 2,
        "additional_dry_time_minutes": 8
      }
    }
  ],
  "fees": [
    { "type": "staff_service_fee", "amount": 40.0 },
    { "type": "delivery_fee", "amount": 50.0 },
    { "type": "vat", "amount": 18.4 }
  ],
  "summary": {
    "subtotal_products": 10.0,
    "subtotal_services": 210.0,
    "staff_service_fee": 40.0,
    "delivery_fee": 50.0,
    "subtotal_before_vat": 310.0,
    "vat_amount": 37.2,
    "total": 347.2
  }
}
```

### Sample Order (handling JSONB)

```json
{
  "service_type": "staff_service",
  "handling_type": "delivery",
  "delivery_address": "123 Main St, Apt 4B",
  "delivery_fee_override": 50.0,
  "special_instructions": "Please fold carefully",
  "payment_method": "cash",
  "amount_paid": 350.0
}
```

### Sample Transaction

```
product_id: uuid-123
order_id: uuid-order-456
quantity_change: -2
transaction_type: "order"
notes: "Order #456 - Plastic bags"
created_at: 2026-01-27 10:30:00
```

---

## Ready! 🎉

Now you have:

- ✅ orders table (stores complete order data)
- ✅ product_transactions table (tracks inventory changes)
- ✅ Both have proper indexes for performance
- ✅ Foreign key relationships set up

Next: Test the system with sample transactions!
