-- ============================================================================
-- Complete Database Migration - Katflix POS System
-- Date: December 17, 2025
-- Purpose: Create all tables from scratch for refactored schema
-- ============================================================================

-- ============================================================================
-- PART 1: CORE BUSINESS ENTITIES
-- ============================================================================

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  address TEXT,
  phone_number TEXT NOT NULL,
  email_address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_email ON customers(email_address);
CREATE INDEX idx_customers_auth_id ON customers(auth_id);

-- Staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  address TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email_address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_auth_id ON staff(auth_id);

-- Roles table
CREATE TABLE public.roles (
  id TEXT PRIMARY KEY CHECK (id IN ('admin', 'cashier', 'attendant', 'rider'))
);

-- Staff-Roles junction table
CREATE TABLE public.staff_roles (
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);

CREATE INDEX idx_staff_roles_role_id ON staff_roles(role_id);
CREATE INDEX idx_staff_roles_staff_id ON staff_roles(staff_id);

-- Products table
create table public.products (
  id uuid not null default gen_random_uuid (),
  item_name text not null,
  unit_price numeric(10, 2) not null default 0.00,
  quantity numeric(10, 2) not null default 0,
  reorder_level numeric(10, 2) not null default 0,
  is_active boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  last_updated timestamp without time zone null default CURRENT_TIMESTAMP,
  unit_cost numeric(10, 2) null default 0.00,
  image_url text null,
  image_alt_text text null,
  constraint products_pkey primary key (id),
  constraint products_quantity_check check ((quantity >= (0)::numeric)),
  constraint products_reorder_level_check check ((reorder_level >= (0)::numeric)),
  constraint products_unit_cost_check check ((unit_cost >= (0)::numeric)),
  constraint products_unit_price_check check ((unit_price >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists idx_products_is_active on public.products using btree (is_active) TABLESPACE pg_default;
create index IF not exists idx_products_item_name on public.products using btree (item_name) TABLESPACE pg_default;
create index IF not exists idx_products_unit_cost on public.products using btree (unit_cost) TABLESPACE pg_default;
create index IF not exists idx_products_image_url on public.products using btree (image_url) TABLESPACE pg_default;

CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_item_name ON products(item_name);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN ('pickup', 'wash', 'spin', 'dry', 'iron', 'fold', 'delivery')),
  name TEXT NOT NULL,
  description TEXT,
  base_duration_minutes NUMERIC CHECK (base_duration_minutes >= 0),
  rate_per_kg NUMERIC(10, 2) CHECK (rate_per_kg >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_service_type ON services(service_type);
CREATE INDEX idx_services_is_active ON services(is_active);

-- Machines table
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_name TEXT NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('wash', 'dry', 'iron')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'running', 'maintenance')),
  last_serviced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_machines_machine_type ON machines(machine_type);

-- ============================================================================
-- PART 2: PRIMARY ORDERS TABLE (JSON-BASED)
-- ============================================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('store', 'app')),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Fulfillment workflow status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Awaiting approval (mobile) or first action (POS)
    'for_pick-up',       -- Rider is on the way for pickup
    'processing',        -- Service workflow active
    'for_delivery',      -- Rider is on the way for delivery
    'completed',         -- All done
    'cancelled'          -- Cancelled order
  )),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,           -- NULL if store (auto-approved), set when mobile approved
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Amounts
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  order_note TEXT,
  
  -- JSON columns (immutable snapshots)
  handling JSONB NOT NULL,         -- Pickup & delivery fulfillment stages
  breakdown JSONB NOT NULL,        -- Complete order breakdown: items, baskets, services, fees, discounts, payment
  cancellation JSONB               -- Cancellation details (NULL if not cancelled)
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_cashier_id ON orders(cashier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_total_amount ON orders(total_amount);
CREATE INDEX idx_orders_breakdown_payment ON orders USING GIN ((breakdown -> 'payment'));
CREATE INDEX idx_orders_handling_pickup ON orders USING GIN ((handling -> 'pickup'));
CREATE INDEX idx_orders_handling_delivery ON orders USING GIN ((handling -> 'delivery'));

-- ============================================================================
-- PART 3: AUDIT & TRACKING
-- ============================================================================

-- Product transactions (unified log for all quantity-related changes)
CREATE TABLE public.product_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  change_type TEXT NOT NULL CHECK (change_type IN ('add', 'remove', 'consume', 'adjust')),
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  reason TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_transactions_product_id ON product_transactions(product_id);
CREATE INDEX idx_product_transactions_order_id ON product_transactions(order_id);
CREATE INDEX idx_product_transactions_created_at ON product_transactions(created_at);
CREATE INDEX idx_product_transactions_change_type ON product_transactions(change_type);

-- ============================================================================
-- PART 4: ISSUES TRACKING
-- ============================================================================

-- Issues tracking
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  basket_number INTEGER,
  
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  reported_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issues_order_id ON issues(order_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(severity);

-- ============================================================================
-- SUMMARY: 8 TABLES CREATED
-- ============================================================================
-- 1. customers            - Customer profiles
-- 2. staff                - Employee profiles
-- 3. products             - Inventory items (minimal, quantity-tracked via product_transactions)
-- 4. services             - Service types (wash, dry, etc)
-- 5. machines             - Equipment/Machines
-- 6. orders               - Main orders table (JSON-based with complete breakdown)
-- 7. product_transactions - Unified audit log for all quantity changes
-- 8. issues               - Problem/defect tracking
-- ============================================================================
