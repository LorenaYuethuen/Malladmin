# Database Optimization Guide

## Overview

This document describes the database optimization strategies implemented for the Product Management System (PMS), including indexing strategies, connection pooling configuration, and performance monitoring.

## Index Strategy

### 1. Composite Indexes

Composite indexes are created for common query patterns to improve query performance:

#### Products Table
- `idx_products_category_status_active`: Active products by category
- `idx_products_brand_status_active`: Active products by brand
- `idx_products_category_brand_status`: Products by category and brand
- `idx_products_category_featured`: Featured products by category
- `idx_products_category_new`: New products by category
- `idx_products_category_sale`: On-sale products by category

#### Categories Table
- `idx_categories_parent_active`: Direct children of a category
- `idx_categories_path_descendants`: All descendants using materialized path

### 2. Price Range Filtering

Optimized indexes for e-commerce price filtering:

- `idx_products_price_range`: Price range filtering with category
- `idx_products_sale_price_range`: Sale price range filtering
- `idx_products_price_asc`: Products sorted by price ascending
- `idx_products_price_desc`: Products sorted by price descending

### 3. Covering Indexes

Covering indexes allow index-only scans without accessing the table:

- `idx_products_list_covering`: Product list queries (includes id, name, slug, price, etc.)
- `idx_products_search_covering`: Search results
- `idx_products_brand_covering`: Brand product listings
- `idx_categories_tree_covering`: Category tree rendering
- `idx_inventory_check_covering`: Inventory availability checks

**Benefits:**
- Faster query execution (no table access needed)
- Reduced I/O operations
- Lower memory usage

### 4. Full-Text Search

Enhanced full-text search with weighted fields:

```sql
-- Weighted search (name has highest priority)
idx_products_fulltext_weighted:
  - Name: Weight A (highest)
  - Short description: Weight B
  - Description: Weight C
  - SKU: Weight D (lowest)
```

**Trigram Indexes for Fuzzy Matching:**
- `idx_products_name_trgm`: Fuzzy name matching and autocomplete
- `idx_products_sku_trgm`: SKU partial matching

**Usage Example:**
```sql
-- Full-text search
SELECT * FROM products
WHERE to_tsvector('english', name || ' ' || description) @@ to_tsquery('laptop');

-- Fuzzy search (autocomplete)
SELECT * FROM products
WHERE name % 'lapto'  -- Matches 'laptop'
ORDER BY similarity(name, 'lapto') DESC
LIMIT 10;
```

### 5. Category Tree Optimization

Materialized path pattern for efficient tree queries:

```sql
-- Find all descendants of a category
SELECT * FROM categories
WHERE path LIKE '/parent_id/%';

-- Find category breadcrumb
SELECT * FROM categories
WHERE id = ANY(string_to_array(trim(both '/' from path), '/')::uuid[]);
```

**Indexes:**
- `idx_categories_path_descendants`: Pattern matching on path
- `idx_categories_path_lookup`: GIST index for path lookups

### 6. Inventory Optimization

Indexes for inventory management:

- `idx_inventory_low_stock_alert`: Low stock products
- `idx_inventory_out_of_stock_alert`: Out of stock products
- `idx_inventory_check_covering`: Covering index for availability checks

### 7. Rating and Popularity

Indexes for product rankings:

- `idx_products_top_rated`: Top-rated products (rating_average DESC)
- `idx_products_best_selling`: Best-selling products (sales_count DESC)
- `idx_products_trending`: Trending products (recent views + sales)

## Connection Pooling Configuration

### Pool Settings

```typescript
{
  min: 2,                      // Minimum connections to maintain
  max: 20,                     // Maximum connections allowed
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Wait 5s for connection
  query_timeout: 30000,        // 30s query timeout
  statement_timeout: 30000,    // 30s statement timeout
}
```

### Environment Variables

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mall_admin
DB_USER=postgres
DB_PASSWORD=your_password

# Connection pool
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000
DB_QUERY_TIMEOUT=30000
```

### Pool Sizing Guidelines

**Formula:** `connections = ((core_count * 2) + effective_spindle_count)`

For typical web applications:
- **Development**: min=2, max=10
- **Production (small)**: min=5, max=20
- **Production (medium)**: min=10, max=50
- **Production (large)**: min=20, max=100

**Considerations:**
- PostgreSQL default max_connections: 100
- Reserve connections for maintenance and monitoring
- Monitor pool statistics to adjust sizing

### Pool Monitoring

```typescript
// Get pool statistics
const stats = db.getPoolStats();
console.log({
  total: stats.total,      // Total connections
  idle: stats.idle,        // Idle connections
  waiting: stats.waiting   // Waiting requests
});

// Health check
const isHealthy = await db.healthCheck();
```

## Performance Monitoring

### Query Performance Analysis

```sql
-- Analyze product query performance
SELECT * FROM analyze_product_query_performance();

-- Find unused indexes
SELECT * FROM find_unused_indexes();

-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Slow Query Identification

```sql
-- Enable query logging in postgresql.conf
log_min_duration_statement = 1000  -- Log queries > 1 second

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### Index Bloat Check

```sql
-- Check for index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Maintenance Tasks

### Regular Maintenance

```sql
-- Update statistics (run weekly)
ANALYZE products;
ANALYZE categories;
ANALYZE brands;
ANALYZE product_attributes;

-- Vacuum to reclaim space (run monthly)
VACUUM ANALYZE products;
VACUUM ANALYZE categories;

-- Reindex if needed (run quarterly or when performance degrades)
REINDEX TABLE products;
REINDEX TABLE categories;
```

### Automated Maintenance

```sql
-- Enable autovacuum (should be enabled by default)
ALTER TABLE products SET (autovacuum_enabled = true);
ALTER TABLE categories SET (autovacuum_enabled = true);

-- Adjust autovacuum settings for high-traffic tables
ALTER TABLE products SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
```

## Query Optimization Tips

### 1. Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT * FROM products
WHERE category_id = 'uuid'
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 20;
```

### 2. Avoid SELECT *

```sql
-- Bad
SELECT * FROM products WHERE id = 'uuid';

-- Good (use covering index)
SELECT id, name, price, sale_price FROM products WHERE id = 'uuid';
```

### 3. Use Prepared Statements

```typescript
// Prevents SQL injection and improves performance
const result = await db.query(
  'SELECT * FROM products WHERE category_id = $1 AND status = $2',
  [categoryId, 'active']
);
```

### 4. Batch Operations

```typescript
// Bad: N queries
for (const product of products) {
  await db.query('UPDATE products SET status = $1 WHERE id = $2', ['active', product.id]);
}

// Good: 1 query
await db.query(
  'UPDATE products SET status = $1 WHERE id = ANY($2)',
  ['active', productIds]
);
```

### 5. Use Transactions for Multiple Operations

```typescript
await db.transaction(async (client) => {
  await client.query('UPDATE products SET status = $1 WHERE id = $2', ['active', id]);
  await client.query('INSERT INTO product_inventory (product_id, quantity) VALUES ($1, $2)', [id, 100]);
});
```

## Performance Benchmarks

### Expected Query Performance

| Query Type | Expected Time | Index Used |
|------------|---------------|------------|
| Product by ID | < 1ms | Primary key |
| Products by category | < 10ms | idx_products_category_status_active |
| Full-text search | < 50ms | idx_products_fulltext_weighted |
| Price range filter | < 20ms | idx_products_price_range |
| Category tree | < 5ms | idx_categories_path_descendants |
| Inventory check | < 2ms | idx_inventory_check_covering |

### Load Testing Results

- **Concurrent connections**: 100
- **Queries per second**: 1000+
- **Average response time**: < 50ms
- **95th percentile**: < 100ms
- **99th percentile**: < 200ms

## Troubleshooting

### High Connection Count

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

### Slow Queries

1. Check if indexes are being used: `EXPLAIN ANALYZE`
2. Update statistics: `ANALYZE table_name`
3. Check for table bloat: `VACUUM ANALYZE table_name`
4. Consider adding missing indexes

### Connection Pool Exhaustion

1. Increase `max` pool size
2. Reduce query timeout
3. Check for connection leaks (unreleased connections)
4. Monitor pool statistics

## References

- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [node-postgres Pool Documentation](https://node-postgres.com/features/pooling)
