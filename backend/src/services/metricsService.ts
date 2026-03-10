/**
 * Prometheus Metrics Service
 * Collects and exposes application metrics for monitoring
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({
  register,
  prefix: 'mall_admin_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Request metrics
export const httpRequestDuration = new Histogram({
  name: 'mall_admin_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'mall_admin_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'mall_admin_http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'mall_admin_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'mall_admin_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const dbConnectionsIdle = new Gauge({
  name: 'mall_admin_db_connections_idle',
  help: 'Number of idle database connections',
  registers: [register],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'mall_admin_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'mall_admin_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

export const cacheOperationDuration = new Histogram({
  name: 'mall_admin_cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Business metrics - Orders
export const ordersCreated = new Counter({
  name: 'mall_admin_orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register],
});

export const orderValue = new Histogram({
  name: 'mall_admin_order_value_dollars',
  help: 'Order value in dollars',
  labelNames: ['status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

export const orderProcessingDuration = new Histogram({
  name: 'mall_admin_order_processing_duration_seconds',
  help: 'Duration of order processing in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Business metrics - Products
export const productsCreated = new Counter({
  name: 'mall_admin_products_created_total',
  help: 'Total number of products created',
  registers: [register],
});

export const productsUpdated = new Counter({
  name: 'mall_admin_products_updated_total',
  help: 'Total number of products updated',
  registers: [register],
});

export const productsDeleted = new Counter({
  name: 'mall_admin_products_deleted_total',
  help: 'Total number of products deleted',
  registers: [register],
});

export const productInventoryLevel = new Gauge({
  name: 'mall_admin_product_inventory_level',
  help: 'Current inventory level for products',
  labelNames: ['product_id', 'sku'],
  registers: [register],
});

// Business metrics - Users
export const usersRegistered = new Counter({
  name: 'mall_admin_users_registered_total',
  help: 'Total number of users registered',
  labelNames: ['role'],
  registers: [register],
});

export const activeUsers = new Gauge({
  name: 'mall_admin_active_users',
  help: 'Number of currently active users',
  labelNames: ['role'],
  registers: [register],
});

// Business metrics - Authentication
export const authAttempts = new Counter({
  name: 'mall_admin_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result'],
  registers: [register],
});

export const authTokensIssued = new Counter({
  name: 'mall_admin_auth_tokens_issued_total',
  help: 'Total number of authentication tokens issued',
  labelNames: ['token_type'],
  registers: [register],
});

// Business metrics - Payments
export const paymentsProcessed = new Counter({
  name: 'mall_admin_payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status', 'payment_method'],
  registers: [register],
});

export const paymentAmount = new Histogram({
  name: 'mall_admin_payment_amount_dollars',
  help: 'Payment amount in dollars',
  labelNames: ['status', 'payment_method'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

// Business metrics - Inventory
export const inventoryReservations = new Counter({
  name: 'mall_admin_inventory_reservations_total',
  help: 'Total number of inventory reservations',
  labelNames: ['result'],
  registers: [register],
});

export const inventoryDeductions = new Counter({
  name: 'mall_admin_inventory_deductions_total',
  help: 'Total number of inventory deductions',
  labelNames: ['result'],
  registers: [register],
});

// Business metrics - Shipping
export const shipmentsCreated = new Counter({
  name: 'mall_admin_shipments_created_total',
  help: 'Total number of shipments created',
  labelNames: ['carrier'],
  registers: [register],
});

export const shipmentStatusUpdates = new Counter({
  name: 'mall_admin_shipment_status_updates_total',
  help: 'Total number of shipment status updates',
  labelNames: ['status'],
  registers: [register],
});

// Business metrics - Returns
export const returnsRequested = new Counter({
  name: 'mall_admin_returns_requested_total',
  help: 'Total number of return requests',
  labelNames: ['reason'],
  registers: [register],
});

export const returnsProcessed = new Counter({
  name: 'mall_admin_returns_processed_total',
  help: 'Total number of returns processed',
  labelNames: ['status'],
  registers: [register],
});

// Business metrics - Marketing
export const couponsUsed = new Counter({
  name: 'mall_admin_coupons_used_total',
  help: 'Total number of coupons used',
  labelNames: ['coupon_type'],
  registers: [register],
});

export const flashSaleViews = new Counter({
  name: 'mall_admin_flash_sale_views_total',
  help: 'Total number of flash sale views',
  labelNames: ['sale_id'],
  registers: [register],
});

// External API metrics
export const externalApiCalls = new Counter({
  name: 'mall_admin_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['service', 'endpoint', 'status'],
  registers: [register],
});

export const externalApiDuration = new Histogram({
  name: 'mall_admin_external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Outbox pattern metrics
export const outboxEventsCreated = new Counter({
  name: 'mall_admin_outbox_events_created_total',
  help: 'Total number of outbox events created',
  labelNames: ['event_type'],
  registers: [register],
});

export const outboxEventsProcessed = new Counter({
  name: 'mall_admin_outbox_events_processed_total',
  help: 'Total number of outbox events processed',
  labelNames: ['event_type', 'status'],
  registers: [register],
});

export const outboxProcessingDuration = new Histogram({
  name: 'mall_admin_outbox_processing_duration_seconds',
  help: 'Duration of outbox event processing in seconds',
  labelNames: ['event_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}
