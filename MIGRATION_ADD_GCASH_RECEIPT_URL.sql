-- Add gcash_receipt_url column to orders table
-- This column stores the path/URL to the GCash receipt image from Supabase storage

ALTER TABLE orders
ADD COLUMN gcash_receipt_url TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN orders.gcash_receipt_url IS 'Path or full URL to GCash receipt image stored in Supabase gcash-receipts bucket. Either a relative path (filename) or complete URL.';

-- Create index for potential queries filtering by receipt URL
CREATE INDEX idx_orders_gcash_receipt_url ON orders(gcash_receipt_url) WHERE gcash_receipt_url IS NOT NULL;
