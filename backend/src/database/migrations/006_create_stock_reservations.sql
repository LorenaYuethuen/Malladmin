-- ============================================================================
-- STOCK_RESERVATIONS TABLE - Track inventory reservations for orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for stock_reservations
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at) WHERE status = 'reserved';

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_stock_reservations_updated_at
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_reservations IS 'Tracks inventory reservations for pending orders with expiration';
COMMENT ON COLUMN stock_reservations.status IS 'reserved=pending, confirmed=order paid, released=cancelled/expired';
COMMENT ON COLUMN stock_reservations.expires_at IS 'Reservation expires after 15 minutes';
