-- Create outbox_events table for Transactional Outbox pattern
-- This table stores events that need to be published to external systems
-- Events are written in the same transaction as business data to ensure consistency

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  version INTEGER DEFAULT 1
);

-- Index for efficient polling of unprocessed events
CREATE INDEX IF NOT EXISTS idx_outbox_events_processed 
  ON outbox_events(processed, created_at) 
  WHERE processed = FALSE;

-- Index for querying events by aggregate
CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate 
  ON outbox_events(aggregate_type, aggregate_id);

-- Index for querying events by type
CREATE INDEX IF NOT EXISTS idx_outbox_events_type 
  ON outbox_events(event_type);

-- Index for cleanup of old processed events
CREATE INDEX IF NOT EXISTS idx_outbox_events_cleanup 
  ON outbox_events(processed, processed_at) 
  WHERE processed = TRUE;

-- Add comment for documentation
COMMENT ON TABLE outbox_events IS 'Transactional outbox for reliable event publishing';
COMMENT ON COLUMN outbox_events.aggregate_type IS 'Type of aggregate (order, product, user, etc.)';
COMMENT ON COLUMN outbox_events.aggregate_id IS 'ID of the aggregate that generated the event';
COMMENT ON COLUMN outbox_events.event_type IS 'Type of event (ORDER_CREATED, PRODUCT_UPDATED, etc.)';
COMMENT ON COLUMN outbox_events.payload IS 'Event data in JSON format';
COMMENT ON COLUMN outbox_events.processed IS 'Whether the event has been successfully published';
COMMENT ON COLUMN outbox_events.retry_count IS 'Number of processing attempts';
COMMENT ON COLUMN outbox_events.last_error IS 'Last error message if processing failed';
