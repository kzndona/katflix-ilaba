-- ============================================================================
-- Add Source Column to Orders Table
-- ============================================================================
-- Adds tracking for order origin (POS or Mobile app)
-- Run this in Supabase SQL Editor

ALTER TABLE orders
ADD COLUMN source TEXT DEFAULT 'pos' CHECK (source IN ('pos', 'mobile'));

-- Index for filtering by source
CREATE INDEX idx_orders_source ON orders(source);

-- Update the composite index to include source
CREATE INDEX idx_orders_source_date ON orders(source, created_at DESC);

COMMENT ON COLUMN orders.source IS 'Order origin: pos (Point of Sale system) or mobile (Mobile app)';
