# Create Product Transactions Table

## Quick Setup

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

### Step 2: Copy & Run the SQL

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS product_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'adjustment',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_transaction_type CHECK (
    transaction_type IN ('order', 'adjustment', 'return', 'restock', 'damage')
  )
);

CREATE INDEX idx_product_transactions_product_id ON product_transactions(product_id);
CREATE INDEX idx_product_transactions_order_id ON product_transactions(order_id);
CREATE INDEX idx_product_transactions_created_at ON product_transactions(created_at DESC);
CREATE INDEX idx_product_transactions_type ON product_transactions(transaction_type);
CREATE INDEX idx_product_transactions_product_date ON product_transactions(product_id, created_at DESC);

ALTER TABLE product_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all transactions"
  ON product_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can create transactions"
  ON product_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE VIEW product_stock_summary AS
SELECT
  p.id,
  p.item_name,
  p.quantity AS current_stock,
  p.reorder_level,
  COALESCE(SUM(CASE WHEN pt.transaction_type = 'order' THEN pt.quantity_change ELSE 0 END), 0) AS total_orders_deducted,
  COALESCE(SUM(CASE WHEN pt.transaction_type = 'restock' THEN pt.quantity_change ELSE 0 END), 0) AS total_restocked,
  COALESCE(COUNT(pt.id), 0) AS transaction_count,
  MAX(pt.created_at) AS last_transaction_date
FROM products p
LEFT JOIN product_transactions pt ON p.id = pt.product_id
WHERE p.is_active = true
GROUP BY p.id, p.item_name, p.quantity, p.reorder_level
ORDER BY p.item_name;

GRANT SELECT ON product_stock_summary TO authenticated;
```

Click **"Run"** button ▶️

### Step 3: Verify Table Created

Go to **"Table Editor"** → You should see `product_transactions` table listed

---

## Table Schema

### Columns

| Column             | Type      | Description                                      |
| ------------------ | --------- | ------------------------------------------------ |
| `id`               | UUID      | Primary key                                      |
| `product_id`       | UUID      | Foreign key to products table                    |
| `order_id`         | UUID      | Foreign key to orders table (optional)           |
| `quantity_change`  | INTEGER   | Positive: stock added, Negative: stock deducted  |
| `transaction_type` | TEXT      | Type: order, adjustment, return, restock, damage |
| `notes`            | TEXT      | Optional reason/reference                        |
| `created_at`       | TIMESTAMP | When transaction occurred                        |
| `created_by`       | UUID      | Which user created it                            |

### Indexes

```
- product_id (fast lookups by product)
- order_id (fast lookups by order)
- created_at (recent transactions first)
- transaction_type (filter by type)
- product_id + created_at (product history)
```

### Constraints

```
- quantity_change must be an integer (+ or -)
- transaction_type must be one of: order, adjustment, return, restock, damage
- Foreign key cascade: if product deleted, transactions deleted
- Foreign key set null: if order deleted, order_id becomes NULL
```

---

## Transaction Types

| Type         | Meaning                    | Quantity | Example                |
| ------------ | -------------------------- | -------- | ---------------------- |
| `order`      | Stock deducted for order   | Negative | -5 (order for 5 items) |
| `adjustment` | Manual stock correction    | ±Any     | +3 (count discrepancy) |
| `return`     | Stock returned by customer | Positive | +2 (return 2 items)    |
| `restock`    | New stock received         | Positive | +50 (new shipment)     |
| `damage`     | Stock damaged/lost         | Negative | -1 (damaged item)      |

---

## Example Transactions

```sql
-- Example 1: Deduct 5 items for order
INSERT INTO product_transactions (product_id, order_id, quantity_change, transaction_type, notes)
VALUES (
  'uuid-of-product',
  'uuid-of-order',
  -5,
  'order',
  'POS Order #12345'
);

-- Example 2: Restock 50 items
INSERT INTO product_transactions (product_id, quantity_change, transaction_type, notes)
VALUES (
  'uuid-of-product',
  50,
  'restock',
  'Received shipment from Supplier ABC'
);

-- Example 3: Inventory correction
INSERT INTO product_transactions (product_id, quantity_change, transaction_type, notes)
VALUES (
  'uuid-of-product',
  -3,
  'adjustment',
  'Physical count revealed 3 missing units'
);
```

---

## Query Examples

### Get transaction history for a product

```sql
SELECT *
FROM product_transactions
WHERE product_id = 'your-product-id'
ORDER BY created_at DESC;
```

### Get total deducted for orders

```sql
SELECT
  product_id,
  SUM(quantity_change) as total_deducted
FROM product_transactions
WHERE transaction_type = 'order'
GROUP BY product_id;
```

### Get summary for all products

```sql
SELECT * FROM product_stock_summary;
```

### Get transactions in date range

```sql
SELECT *
FROM product_transactions
WHERE created_at >= '2026-01-01' AND created_at <= '2026-01-31'
ORDER BY created_at DESC;
```

---

## Testing

After creating the table, test the inventory management page:

1. Go to `http://localhost:3001/in/inventory`
2. Select a product
3. Click "Record Transaction"
4. Verify transaction appears in history
5. Check Supabase: Table Editor → product_transactions → should show your transaction

---

## Troubleshooting

**"Table already exists" error?**

- Table is already created ✅

**"Permission denied" error?**

- Make sure you're logged into Supabase with admin account
- Check RLS policies are set correctly

**Can't see transactions in inventory page?**

- Verify `product_id` exists in products table
- Check browser console for errors

---

Done! Now your inventory transaction system is ready. 🎉
