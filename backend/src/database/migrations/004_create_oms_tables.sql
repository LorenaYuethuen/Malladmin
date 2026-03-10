-- ============================================================================
-- Order Management System (OMS) Database Schema
-- ============================================================================
-- This migration creates all tables required for the Order Management System
-- including orders, order items, shipping, tracking, returns, and addresses.
-- Requirements: 2.1, 2.2, 2.3, 2.4, 2.9

-- ============================================================================
-- 1. ORDERS TABLE - Main order table
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  
  -- Payment
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'
  )),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Shipping
  shipping_method VARCHAR(50),
  estimated_delivery_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  customer_notes TEXT,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at DESC) WHERE delivered_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at DESC);

-- Full-text search index for order search
CREATE INDEX IF NOT EXISTS idx_orders_search ON orders USING GIN(
  to_tsvector('english', COALESCE(order_number, '') || ' ' || COALESCE(customer_notes, ''))
);

-- ============================================================================
-- 2. ORDER_ITEMS TABLE - Order line items
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  -- Product snapshot (at time of order)
  product_name VARCHAR(500) NOT NULL,
  product_sku VARCHAR(100) NOT NULL,
  product_image_url TEXT,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'
  )),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(product_sku);

-- ============================================================================
-- 3. ORDER_ADDRESSES TABLE - Shipping and billing addresses
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('shipping', 'billing')),
  
  -- Contact information
  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  
  -- Address details
  address_line1 VARCHAR(500) NOT NULL,
  address_line2 VARCHAR(500),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'China',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one shipping and one billing address per order
  UNIQUE(order_id, address_type)
);

-- Indexes for order_addresses
CREATE INDEX IF NOT EXISTS idx_order_addresses_order_id ON order_addresses(order_id);
CREATE INDEX IF NOT EXISTS idx_order_addresses_type ON order_addresses(order_id, address_type);
CREATE INDEX IF NOT EXISTS idx_order_addresses_postal_code ON order_addresses(postal_code);
CREATE INDEX IF NOT EXISTS idx_order_addresses_city ON order_addresses(city);

-- ============================================================================
-- 4. ORDER_TRACKING TABLE - Logistics tracking information
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number VARCHAR(100) NOT NULL UNIQUE,
  
  -- Logistics information
  carrier VARCHAR(100) NOT NULL,
  shipping_method VARCHAR(100),
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'
  )),
  
  -- Timestamps
  shipped_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for order_tracking
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_tracking_number ON order_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_order_tracking_carrier ON order_tracking(carrier);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON order_tracking(status);
CREATE INDEX IF NOT EXISTS idx_order_tracking_shipped_at ON order_tracking(shipped_at DESC) WHERE shipped_at IS NOT NULL;

-- ============================================================================
-- 5. TRACKING_UPDATES TABLE - Tracking status history
-- ============================================================================
CREATE TABLE IF NOT EXISTS tracking_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES order_tracking(id) ON DELETE CASCADE,
  
  -- Update details
  status VARCHAR(30) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  
  -- Timestamps
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tracking_updates
CREATE INDEX IF NOT EXISTS idx_tracking_updates_tracking_id ON tracking_updates(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_updates_occurred_at ON tracking_updates(tracking_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_updates_status ON tracking_updates(status);

-- ============================================================================
-- 6. RETURN_REQUESTS TABLE - Return and refund requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(50) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled'
  )),
  
  -- Return reason
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Refund information
  refund_amount DECIMAL(10, 2) NOT NULL CHECK (refund_amount >= 0),
  refund_method VARCHAR(50),
  refund_status VARCHAR(20) DEFAULT 'pending' CHECK (refund_status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  
  -- Notes
  admin_notes TEXT,
  
  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for return_requests
CREATE INDEX IF NOT EXISTS idx_return_requests_return_number ON return_requests(return_number);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_refund_status ON return_requests(refund_status);
CREATE INDEX IF NOT EXISTS idx_return_requests_requested_at ON return_requests(requested_at DESC);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_user_status ON return_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_status_requested ON return_requests(status, requested_at DESC);

-- ============================================================================
-- 7. RETURN_ITEMS TABLE - Individual items in return request
-- ============================================================================
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  
  -- Return details
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason VARCHAR(100) NOT NULL,
  condition VARCHAR(50),
  
  -- Refund
  refund_amount DECIMAL(10, 2) NOT NULL CHECK (refund_amount >= 0),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'received', 'refunded'
  )),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for return_items
CREATE INDEX IF NOT EXISTS idx_return_items_return_request_id ON return_items(return_request_id);
CREATE INDEX IF NOT EXISTS idx_return_items_order_item_id ON return_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_return_items_status ON return_items(status);

-- ============================================================================
-- TRIGGERS - Auto-update timestamps
-- ============================================================================

-- Trigger for orders
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for order_items
CREATE TRIGGER update_order_items_updated_at 
  BEFORE UPDATE ON order_items
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for order_tracking
CREATE TRIGGER update_order_tracking_updated_at 
  BEFORE UPDATE ON order_tracking
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for return_requests
CREATE TRIGGER update_return_requests_updated_at 
  BEFORE UPDATE ON return_requests
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for return_items
CREATE TRIGGER update_return_items_updated_at 
  BEFORE UPDATE ON return_items
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS - Helper functions for OMS
-- ============================================================================

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $
DECLARE
  new_number TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Format: ORD-YYYYMMDD-XXXXXX (e.g., ORD-20240115-123456)
    new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                  LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    
    -- Check if number already exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN new_number;
END;
$ LANGUAGE plpgsql;

-- Function to generate unique return number
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS TEXT AS $
DECLARE
  new_number TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Format: RET-YYYYMMDD-XXXXXX (e.g., RET-20240115-123456)
    new_number := 'RET-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                  LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    
    -- Check if number already exists
    SELECT EXISTS(SELECT 1 FROM return_requests WHERE return_number = new_number) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN new_number;
END;
$ LANGUAGE plpgsql;

-- Function to calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_totals()
RETURNS TRIGGER AS $
BEGIN
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(total), 0)
  INTO NEW.subtotal
  FROM order_items
  WHERE order_id = NEW.id;
  
  -- Calculate final total
  NEW.total = NEW.subtotal + NEW.tax + NEW.shipping_cost - NEW.discount;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to auto-calculate order totals when items change
CREATE TRIGGER calculate_order_totals_trigger
  BEFORE UPDATE OF subtotal, tax, shipping_cost, discount ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_totals();

-- Function to update order status when all items are delivered
CREATE OR REPLACE FUNCTION update_order_status_on_items()
RETURNS TRIGGER AS $
DECLARE
  all_delivered BOOLEAN;
  order_status VARCHAR(20);
BEGIN
  -- Get current order status
  SELECT status INTO order_status FROM orders WHERE id = NEW.order_id;
  
  -- Only update if order is in shipped status
  IF order_status = 'shipped' THEN
    -- Check if all items are delivered
    SELECT NOT EXISTS(
      SELECT 1 FROM order_items 
      WHERE order_id = NEW.order_id 
      AND status NOT IN ('delivered', 'returned', 'cancelled')
    ) INTO all_delivered;
    
    -- Update order status if all items delivered
    IF all_delivered THEN
      UPDATE orders 
      SET status = 'delivered', 
          delivered_at = CURRENT_TIMESTAMP
      WHERE id = NEW.order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_status_on_items_trigger
  AFTER UPDATE OF status ON order_items
  FOR EACH ROW
  WHEN (NEW.status = 'delivered')
  EXECUTE FUNCTION update_order_status_on_items();

-- Function to create outbox event for order events
CREATE OR REPLACE FUNCTION create_order_outbox_event()
RETURNS TRIGGER AS $
DECLARE
  event_type TEXT;
  event_payload JSONB;
BEGIN
  -- Determine event type based on operation and status
  IF TG_OP = 'INSERT' THEN
    event_type := 'ORDER_CREATED';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      CASE NEW.status
        WHEN 'confirmed' THEN event_type := 'ORDER_CONFIRMED';
        WHEN 'paid' THEN event_type := 'ORDER_PAID';
        WHEN 'shipped' THEN event_type := 'ORDER_SHIPPED';
        WHEN 'delivered' THEN event_type := 'ORDER_DELIVERED';
        WHEN 'cancelled' THEN event_type := 'ORDER_CANCELLED';
        WHEN 'refunded' THEN event_type := 'ORDER_REFUNDED';
        ELSE event_type := 'ORDER_UPDATED';
      END CASE;
    ELSE
      event_type := 'ORDER_UPDATED';
    END IF;
  END IF;
  
  -- Build event payload
  event_payload := jsonb_build_object(
    'orderId', NEW.id,
    'orderNumber', NEW.order_number,
    'userId', NEW.user_id,
    'status', NEW.status,
    'total', NEW.total,
    'paymentStatus', NEW.payment_status
  );
  
  -- Insert into outbox_events
  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) VALUES (
    'order',
    NEW.id::TEXT,
    event_type,
    event_payload
  );
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER create_order_outbox_event_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_outbox_event();

-- Function to create outbox event for return events
CREATE OR REPLACE FUNCTION create_return_outbox_event()
RETURNS TRIGGER AS $
DECLARE
  event_type TEXT;
  event_payload JSONB;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'RETURN_REQUESTED';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      CASE NEW.status
        WHEN 'approved' THEN event_type := 'RETURN_APPROVED';
        WHEN 'rejected' THEN event_type := 'RETURN_REJECTED';
        WHEN 'completed' THEN event_type := 'RETURN_COMPLETED';
        ELSE event_type := 'RETURN_UPDATED';
      END CASE;
    ELSE
      event_type := 'RETURN_UPDATED';
    END IF;
  END IF;
  
  -- Build event payload
  event_payload := jsonb_build_object(
    'returnId', NEW.id,
    'returnNumber', NEW.return_number,
    'orderId', NEW.order_id,
    'userId', NEW.user_id,
    'status', NEW.status,
    'refundAmount', NEW.refund_amount
  );
  
  -- Insert into outbox_events
  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) VALUES (
    'return',
    NEW.id::TEXT,
    event_type,
    event_payload
  );
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER create_return_outbox_event_trigger
  AFTER INSERT OR UPDATE ON return_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_return_outbox_event();

-- ============================================================================
-- COMMENTS - Table and column documentation
-- ============================================================================

COMMENT ON TABLE orders IS 'Main orders table with comprehensive order information';
COMMENT ON COLUMN orders.order_number IS 'Unique order identifier visible to customers';
COMMENT ON COLUMN orders.status IS 'Order lifecycle status';
COMMENT ON COLUMN orders.payment_status IS 'Payment processing status';
COMMENT ON COLUMN orders.total IS 'Final order total including tax and shipping';

COMMENT ON TABLE order_items IS 'Order line items with product snapshots at time of purchase';
COMMENT ON COLUMN order_items.product_name IS 'Product name snapshot at time of order';
COMMENT ON COLUMN order_items.product_sku IS 'Product SKU snapshot at time of order';

COMMENT ON TABLE order_addresses IS 'Shipping and billing addresses for orders';
COMMENT ON COLUMN order_addresses.address_type IS 'Address type: shipping or billing';

COMMENT ON TABLE order_tracking IS 'Logistics tracking information for shipped orders';
COMMENT ON COLUMN order_tracking.tracking_number IS 'Unique tracking number from carrier';
COMMENT ON COLUMN order_tracking.carrier IS 'Shipping carrier name (e.g., 顺丰, 圆通, 中通)';

COMMENT ON TABLE tracking_updates IS 'Historical tracking status updates from carriers';
COMMENT ON COLUMN tracking_updates.occurred_at IS 'When the tracking event occurred';

COMMENT ON TABLE return_requests IS 'Customer return and refund requests';
COMMENT ON COLUMN return_requests.return_number IS 'Unique return identifier';
COMMENT ON COLUMN return_requests.refund_amount IS 'Total refund amount for this return';

COMMENT ON TABLE return_items IS 'Individual items included in return request';
COMMENT ON COLUMN return_items.quantity IS 'Quantity of items being returned';
COMMENT ON COLUMN return_items.condition IS 'Condition of returned items';

-- ============================================================================
-- SEED DATA - Sample data for testing
-- ============================================================================

-- Note: Sample orders will be created through the application
-- This ensures proper order number generation and event creation

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration creates a comprehensive Order Management System schema
-- with support for:
-- - Complete order lifecycle management
-- - Order items with product snapshots
-- - Shipping and billing addresses
-- - Logistics tracking with carrier integration
-- - Tracking status history
-- - Return and refund processing
-- - Outbox pattern for event-driven architecture
-- - Automatic order number generation
-- - Order status automation
-- - Comprehensive indexing for performance
-- - Audit trails with timestamps
-- ============================================================================
