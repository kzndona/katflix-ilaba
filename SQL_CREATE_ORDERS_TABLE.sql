-- ============================================================================
-- Orders Table Migration
-- ============================================================================
-- For POS system with breakdown (baskets + items) and handling (payment/delivery)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Order Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  
  -- Order Breakdown (JSONB)
  -- Contains: items[], baskets[], fees[], summary{}
  -- items: product purchases (product_id, quantity, unit_price)
  -- baskets: laundry services (wash, dry, spin, iron, additional_dry_time)
  -- fees: staff_service_fee, delivery_fee, vat
  -- summary: subtotals and final total
  breakdown JSONB NOT NULL,
  
  -- Order Handling (JSONB)
  -- Contains: service_type, handling_type, delivery_address, payment_method, etc.
  -- service_type: 'self_service' or 'staff_service'
  -- handling_type: 'pickup' or 'delivery'
  -- payment_method: 'cash' or 'gcash'
  handling JSONB NOT NULL,
  
  -- Financial
  total_amount NUMERIC(10,2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Soft Delete
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Lookup by customer
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Lookup by cashier
CREATE INDEX idx_orders_cashier_id ON orders(cashier_id);

-- Lookup by status
CREATE INDEX idx_orders_status ON orders(status);

-- Lookup by date (recent orders first)
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Search in breakdown JSONB
CREATE INDEX idx_orders_breakdown_gin ON orders USING GIN (breakdown);

-- Search in handling JSONB
CREATE INDEX idx_orders_handling_gin ON orders USING GIN (handling);

-- Find orders by payment method
CREATE INDEX idx_orders_payment_method ON orders USING GIN ((handling -> 'payment_method'));

-- Find delivered orders
CREATE INDEX idx_orders_delivery ON orders USING GIN ((handling -> 'handling_type'));

-- Composite index for common queries (customer + date)
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at DESC);

COMMENT ON TABLE orders IS 'POS orders with laundry services (baskets) and product purchases';
COMMENT ON COLUMN orders.breakdown IS 'JSONB: {items, baskets, fees, summary}';
COMMENT ON COLUMN orders.handling IS 'JSONB: {service_type, handling_type, delivery_address, payment_method, amount_paid, ...}';
