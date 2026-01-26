-- Migration: Create basket_service_status table for tracking service progression
-- Created: 2026-01-27
-- Purpose: Track individual service status per basket independent of order breakdown JSONB

CREATE TABLE IF NOT EXISTS basket_service_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  basket_number INT NOT NULL,
  service_type VARCHAR(50) NOT NULL, -- 'wash', 'dry', 'spin', 'iron', 'fold'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  started_by UUID REFERENCES staff(id),
  completed_by UUID REFERENCES staff(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  CONSTRAINT valid_service_type CHECK (service_type IN ('wash', 'dry', 'spin', 'iron', 'fold')),
  CONSTRAINT unique_order_basket_service UNIQUE(order_id, basket_number, service_type)
);

-- Create indices for faster queries
CREATE INDEX idx_basket_service_status_order_id ON basket_service_status(order_id);
CREATE INDEX idx_basket_service_status_order_basket ON basket_service_status(order_id, basket_number);
CREATE INDEX idx_basket_service_status_status ON basket_service_status(status);