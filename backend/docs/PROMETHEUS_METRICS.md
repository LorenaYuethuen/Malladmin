# Prometheus Metrics

This document describes the Prometheus metrics exposed by the Mall Admin backend application.

## Metrics Endpoint

The metrics are exposed at:
```
GET /metrics
```

This endpoint returns metrics in Prometheus text format that can be scraped by a Prometheus server.

## Metric Categories

### 1. Default System Metrics

These metrics are automatically collected by the Prometheus client:

- `mall_admin_process_cpu_user_seconds_total` - Total user CPU time spent
- `mall_admin_process_cpu_system_seconds_total` - Total system CPU time spent
- `mall_admin_process_resident_memory_bytes` - Resident memory size in bytes
- `mall_admin_process_heap_bytes` - Process heap size in bytes
- `mall_admin_nodejs_eventloop_lag_seconds` - Event loop lag in seconds
- `mall_admin_nodejs_gc_duration_seconds` - Garbage collection duration

### 2. HTTP Request Metrics

- `mall_admin_http_request_duration_seconds` - Histogram of HTTP request durations
  - Labels: `method`, `route`, `status_code`
  - Buckets: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 2s, 5s

- `mall_admin_http_requests_total` - Counter of total HTTP requests
  - Labels: `method`, `route`, `status_code`

- `mall_admin_http_request_errors_total` - Counter of HTTP request errors
  - Labels: `method`, `route`, `error_type`

### 3. Database Metrics

- `mall_admin_db_query_duration_seconds` - Histogram of database query durations
  - Labels: `operation`, `table`
  - Buckets: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 2s

- `mall_admin_db_connections_active` - Gauge of active database connections

- `mall_admin_db_connections_idle` - Gauge of idle database connections

### 4. Cache Metrics

- `mall_admin_cache_hits_total` - Counter of cache hits
  - Labels: `cache_key_prefix`

- `mall_admin_cache_misses_total` - Counter of cache misses
  - Labels: `cache_key_prefix`

- `mall_admin_cache_operation_duration_seconds` - Histogram of cache operation durations
  - Labels: `operation`
  - Buckets: 0.1ms, 0.5ms, 1ms, 5ms, 10ms, 50ms, 100ms

### 5. Business Metrics - Orders

- `mall_admin_orders_created_total` - Counter of orders created
  - Labels: `status`

- `mall_admin_order_value_dollars` - Histogram of order values
  - Labels: `status`
  - Buckets: $10, $50, $100, $200, $500, $1000, $2000, $5000

- `mall_admin_order_processing_duration_seconds` - Histogram of order processing durations
  - Labels: `status`
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s, 60s

### 6. Business Metrics - Products

- `mall_admin_products_created_total` - Counter of products created
- `mall_admin_products_updated_total` - Counter of products updated
- `mall_admin_products_deleted_total` - Counter of products deleted

- `mall_admin_product_inventory_level` - Gauge of product inventory levels
  - Labels: `product_id`, `sku`

### 7. Business Metrics - Users

- `mall_admin_users_registered_total` - Counter of users registered
  - Labels: `role`

- `mall_admin_active_users` - Gauge of currently active users
  - Labels: `role`

### 8. Business Metrics - Authentication

- `mall_admin_auth_attempts_total` - Counter of authentication attempts
  - Labels: `result` (success, failure)

- `mall_admin_auth_tokens_issued_total` - Counter of authentication tokens issued
  - Labels: `token_type` (access, refresh)

### 9. Business Metrics - Payments

- `mall_admin_payments_processed_total` - Counter of payments processed
  - Labels: `status`, `payment_method`

- `mall_admin_payment_amount_dollars` - Histogram of payment amounts
  - Labels: `status`, `payment_method`
  - Buckets: $10, $50, $100, $200, $500, $1000, $2000, $5000

### 10. Business Metrics - Inventory

- `mall_admin_inventory_reservations_total` - Counter of inventory reservations
  - Labels: `result` (success, failure)

- `mall_admin_inventory_deductions_total` - Counter of inventory deductions
  - Labels: `result` (success, failure)

### 11. Business Metrics - Shipping

- `mall_admin_shipments_created_total` - Counter of shipments created
  - Labels: `carrier`

- `mall_admin_shipment_status_updates_total` - Counter of shipment status updates
  - Labels: `status`

### 12. Business Metrics - Returns

- `mall_admin_returns_requested_total` - Counter of return requests
  - Labels: `reason`

- `mall_admin_returns_processed_total` - Counter of returns processed
  - Labels: `status`

### 13. Business Metrics - Marketing

- `mall_admin_coupons_used_total` - Counter of coupons used
  - Labels: `coupon_type`

- `mall_admin_flash_sale_views_total` - Counter of flash sale views
  - Labels: `sale_id`

### 14. External API Metrics

- `mall_admin_external_api_calls_total` - Counter of external API calls
  - Labels: `service`, `endpoint`, `status`

- `mall_admin_external_api_duration_seconds` - Histogram of external API call durations
  - Labels: `service`, `endpoint`
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s

### 15. Outbox Pattern Metrics

- `mall_admin_outbox_events_created_total` - Counter of outbox events created
  - Labels: `event_type`

- `mall_admin_outbox_events_processed_total` - Counter of outbox events processed
  - Labels: `event_type`, `status`

- `mall_admin_outbox_processing_duration_seconds` - Histogram of outbox event processing durations
  - Labels: `event_type`
  - Buckets: 10ms, 50ms, 100ms, 500ms, 1s, 2s, 5s

## Usage Examples

### Recording Business Metrics

```typescript
import { ordersCreated, orderValue } from '../services/metricsService';

// Record order creation
ordersCreated.inc({ status: 'pending' });

// Record order value
orderValue.observe({ status: 'pending' }, 150.00);
```

### Recording Database Metrics

```typescript
import { dbQueryDuration } from '../services/metricsService';

const start = Date.now();
// Execute database query
const duration = (Date.now() - start) / 1000;
dbQueryDuration.observe({ operation: 'select', table: 'products' }, duration);
```

### Recording Cache Metrics

```typescript
import { cacheHits, cacheMisses } from '../services/metricsService';

if (cachedValue) {
  cacheHits.inc({ cache_key_prefix: 'product' });
} else {
  cacheMisses.inc({ cache_key_prefix: 'product' });
}
```

## Prometheus Configuration

Add this job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'mall-admin-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Grafana Dashboards

### Recommended Panels

1. **Request Rate**: `rate(mall_admin_http_requests_total[5m])`
2. **Error Rate**: `rate(mall_admin_http_request_errors_total[5m])`
3. **Request Duration (p95)**: `histogram_quantile(0.95, rate(mall_admin_http_request_duration_seconds_bucket[5m]))`
4. **Database Query Duration (p95)**: `histogram_quantile(0.95, rate(mall_admin_db_query_duration_seconds_bucket[5m]))`
5. **Cache Hit Rate**: `rate(mall_admin_cache_hits_total[5m]) / (rate(mall_admin_cache_hits_total[5m]) + rate(mall_admin_cache_misses_total[5m]))`
6. **Orders per Minute**: `rate(mall_admin_orders_created_total[1m]) * 60`
7. **Revenue per Hour**: `rate(mall_admin_order_value_dollars_sum[1h]) * 3600`

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: mall_admin_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(mall_admin_http_request_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: SlowDatabaseQueries
        expr: histogram_quantile(0.95, rate(mall_admin_db_query_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          description: "95th percentile query duration is {{ $value }}s"

      - alert: LowCacheHitRate
        expr: rate(mall_admin_cache_hits_total[5m]) / (rate(mall_admin_cache_hits_total[5m]) + rate(mall_admin_cache_misses_total[5m])) < 0.7
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}"
```

## Best Practices

1. **Label Cardinality**: Keep label cardinality low. Avoid using user IDs or other high-cardinality values as labels.

2. **Metric Naming**: Follow Prometheus naming conventions:
   - Use `_total` suffix for counters
   - Use `_seconds` suffix for durations
   - Use `_bytes` suffix for sizes

3. **Histogram Buckets**: Choose buckets that make sense for your use case. The default buckets may not be appropriate for all metrics.

4. **Performance**: Metrics collection has minimal overhead, but be mindful of the number of metrics and labels you create.

5. **Security**: Consider restricting access to the `/metrics` endpoint in production environments.

## Troubleshooting

### Metrics not appearing

1. Check that the metrics endpoint is accessible: `curl http://localhost:3000/metrics`
2. Verify Prometheus is scraping the endpoint: Check Prometheus targets page
3. Check application logs for errors

### High memory usage

1. Reduce label cardinality
2. Decrease histogram bucket count
3. Increase scrape interval in Prometheus

### Missing business metrics

1. Ensure metrics are being recorded in the application code
2. Check that the metric names match between code and queries
3. Verify labels are being set correctly
