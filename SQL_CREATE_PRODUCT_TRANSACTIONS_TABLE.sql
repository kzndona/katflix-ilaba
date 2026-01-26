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