/**
 * Transactional Outbox Pattern Types
 * 
 * These types define the structure for the outbox pattern implementation,
 * which ensures reliable event publishing across distributed systems.
 */

export type AggregateType = 'order' | 'product' | 'category' | 'brand' | 'attribute' | 'user' | 'coupon' | 'inventory' | 'return';

export type EventType =
  // Order events
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PAID'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
  // Product events
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_STOCK_CHANGED'
  // Category events
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED'
  // Brand events
  | 'BRAND_CREATED'
  | 'BRAND_UPDATED'
  | 'BRAND_DELETED'
  // Attribute events
  | 'ATTRIBUTE_CREATED'
  | 'ATTRIBUTE_UPDATED'
  | 'ATTRIBUTE_DELETED'
  // User events
  | 'USER_REGISTERED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  // Coupon events
  | 'COUPON_CREATED'
  | 'COUPON_USED'
  | 'COUPON_EXPIRED'
  // Inventory events
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_DEDUCTED'
  | 'INVENTORY_RELEASED'
  | 'INVENTORY_LOW_STOCK';

export interface OutboxEvent {
  id: string;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: EventType;
  payload: Record<string, any>;
  createdAt: Date;
  processedAt: Date | null;
  processed: boolean;
  retryCount: number;
  lastError: string | null;
  version: number;
}

export interface CreateOutboxEventData {
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: EventType;
  payload: Record<string, any>;
}

export interface OutboxEventFilter {
  processed?: boolean;
  aggregateType?: AggregateType;
  eventType?: EventType;
  limit?: number;
}

export interface ProcessingResult {
  success: boolean;
  eventId: string;
  error?: string;
}
