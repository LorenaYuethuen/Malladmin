# PMS Index Reference Guide

Quick reference for developers working with Product Management System queries.

## Index Usage by Query Pattern

### Product Queries

#### Get Active Products by Category
```sql
SELECT * FROM products 
WHERE category_id = $1 AND status = 'active'
ORDER BY created_at DESC;
```
**Index Used:** `idx_products_category_status_active`

#### Get Active Products by Brand
```sql
SELECT * FROM products 
WHERE brand_id = $1 AND status = 'active'
ORDER BY created_at DESC;
```
**Index Used:** `idx_products_brand_status_active`

#### Filter by Price Range
```sql
SELECT * FROM products 
WHERE price BETWEEN $1 AND $2 
  AND status = 'active'
  AND category_id = $3;
```
**Index Used:** `idx_products_price_range`

#### Full-Text Search
```sql
SELECT * FROM products 
WHERE to_tsvector('english', name || ' ' || description) @@ to_tsquery('search_term')
  AND status = 'active';
```
**Index Used:** `idx_products_fulltext_weighted`

#### Fuzzy/Autocomplete Search
```sql
SELECT * FROM products 
WHERE name % 'search_term'
  AND status = 'active'
ORDER BY similarity(name, 'search_term') DESC
LIMIT 10;
```
**Index Used:** `idx_products_name_trgm`

#### Get Featured Products
```sql
SELECT * FROM products 
WHERE category_id = $1 
  AND is_featured = TRUE 
  AND status = 'active';
```
**Index Used:** `idx_products_category_featured`

#### Get Top Rated Products
```sql
SELECT * FROM products 
WHERE status = 'active' 
  AND rating_count >= 5
ORDER BY rating_average DESC, rating_count DESC
LIMIT 20;
```
**Index Used:** `idx_products_top_rated`

#### Get Best Selling Products
```sql
SELECT * FROM products 
WHERE status = 'active'
ORDER BY sales_count DESC
LIMIT 20;
```
**Index Used:** `idx_products_best_selling`

### Category Queries

#### Get Category Tree (All Descendants)
```sql
SELECT * FROM categories 
WHERE path LIKE '/parent_id/%'
  AND is_active = TRUE
ORDER BY level, sort_order;
```
**Index Used:** `idx_categories_path_descendants`

#### Get Direct Children
```sql
SELECT * FROM categories 
WHERE parent_id = $1 
  AND is_active = TRUE
ORDER BY sort_order;
```
**Index Used:** `idx_categories_parent_active`

#### Get Category Breadcrumb
```sql
SELECT * FROM categories 
WHERE id = ANY(string_to_array(trim(both '/' from $1), '/')::uuid[])
ORDER BY level;
```
**Index Used:** `idx_categories_path_lookup`

### Inventory Queries

#### Check Product Availability
```sql
SELECT product_id, quantity, reserved_quantity, available_quantity, is_in_stock
FROM product_inventory 
WHERE product_id = $1;
```
**Index Used:** `idx_inventory_check_covering` (index-only scan)

#### Get Low Stock Products
```sql
SELECT * FROM product_inventory 
WHERE is_low_stock = TRUE;
```
**Index Used:** `idx_inventory_low_stock_alert`

#### Get Out of Stock Products
```sql
SELECT * FROM product_inventory 
WHERE is_in_stock = FALSE;
```
**Index Used:** `idx_inventory_out_of_stock_alert`

### Attribute Queries

#### Filter Products by Attribute
```sql
SELECT DISTINCT pa.product_id 
FROM product_attributes pa
WHERE pa.attribute_id = $1 
  AND pa.value = $2;
```
**Index Used:** `idx_product_attributes_filter`

#### Get Products with Multiple Attributes
```sql
SELECT product_id 
FROM product_attributes
WHERE (attribute_id = $1 AND value = $2)
   OR (attribute_id = $3 AND value = $4)
GROUP BY product_id
HAVING COUNT(DISTINCT attribute_id) = 2;
```
**Index Used:** `idx_product_attributes_covering`

## Performance Tips

### 1. Use Covering Indexes for List Queries

```typescript
// Good: Uses covering index (index-only scan)
const products = await db.query(`
  SELECT id, name, slug, price, sale_price, is_featured, is_on_sale, rating_average
  FROM products
  WHERE status = 'active' AND category_id = $1
  ORDER BY created_at DESC
  LIMIT 20
`, [categoryId]);
```

### 2. Avoid SELECT * When Possible

```typescript
// Bad: Fetches all columns
const products = await db.query('SELECT * FROM products WHERE id = $1', [id]);

// Good: Fetches only needed columns
const products = await db.query(
  'SELECT id, name, price, sale_price FROM products WHERE id = $1',
  [id]
);
```

### 3. Use Batch Operations

```typescript
// Bad: Multiple queries
for (const id of productIds) {
  await db.query('UPDATE products SET status = $1 WHERE id = $2', ['active', id]);
}

// Good: Single batch query
await db.query(
  'UPDATE products SET status = $1 WHERE id = ANY($2)',
  ['active', productIds]
);
```

### 4. Leverage Partial Indexes

```typescript
// Query for active products automatically uses partial index
const products = await db.query(`
  SELECT * FROM products 
  WHERE status = 'active' AND category_id = $1
`, [categoryId]);
// Uses: idx_products_category_status_active (partial index)
```

### 5. Use Prepared Statements

```typescript
// Prepared statement (cached query plan)
const result = await db.query(
  'SELECT * FROM products WHERE category_id = $1 AND status = $2',
  [categoryId, 'active']
);
```

## Common Query Patterns

### Product List with Filters

```typescript
async function getProducts(filters: {
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const conditions = ['status = $1'];
  const params: any[] = [filters.status || 'active'];
  let paramIndex = 2;

  if (filters.categoryId) {
    conditions.push(`category_id = $${paramIndex++}`);
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    conditions.push(`brand_id = $${paramIndex++}`);
    params.push(filters.brandId);
  }

  if (filters.minPrice !== undefined) {
    conditions.push(`price >= $${paramIndex++}`);
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`price <= $${paramIndex++}`);
    params.push(filters.maxPrice);
  }

  if (filters.search) {
    conditions.push(`to_tsvector('english', name || ' ' || description) @@ to_tsquery($${paramIndex++})`);
    params.push(filters.search);
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  const query = `
    SELECT id, name, slug, price, sale_price, rating_average
    FROM products
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);

  return await db.query(query, params);
}
```

### Category Tree with Products Count

```typescript
async function getCategoryTreeWithCounts(parentId?: string) {
  const query = `
    WITH RECURSIVE category_tree AS (
      SELECT c.*, 0 as depth
      FROM categories c
      WHERE c.parent_id ${parentId ? '= $1' : 'IS NULL'}
        AND c.is_active = TRUE
      
      UNION ALL
      
      SELECT c.*, ct.depth + 1
      FROM categories c
      INNER JOIN category_tree ct ON c.parent_id = ct.id
      WHERE c.is_active = TRUE
    )
    SELECT 
      ct.*,
      COUNT(p.id) as product_count
    FROM category_tree ct
    LEFT JOIN products p ON p.category_id = ct.id AND p.status = 'active'
    GROUP BY ct.id, ct.name, ct.slug, ct.parent_id, ct.path, ct.level, ct.depth
    ORDER BY ct.depth, ct.sort_order
  `;

  return await db.query(query, parentId ? [parentId] : []);
}
```

### Product Search with Ranking

```typescript
async function searchProducts(searchTerm: string, limit: number = 20) {
  const query = `
    SELECT 
      id,
      name,
      slug,
      price,
      sale_price,
      rating_average,
      ts_rank(
        to_tsvector('english', name || ' ' || description),
        to_tsquery('english', $1)
      ) as rank
    FROM products
    WHERE status = 'active'
      AND to_tsvector('english', name || ' ' || description) @@ to_tsquery('english', $1)
    ORDER BY rank DESC, rating_average DESC
    LIMIT $2
  `;

  return await db.query(query, [searchTerm, limit]);
}
```

## Index Maintenance

### Check Index Usage

```sql
-- View index usage statistics
SELECT * FROM analyze_product_query_performance();

-- Find unused indexes
SELECT * FROM find_unused_indexes();
```

### Update Statistics

```sql
-- Run after bulk data changes
ANALYZE products;
ANALYZE categories;
ANALYZE product_attributes;
```

### Reindex (if needed)

```sql
-- Rebuild indexes if performance degrades
REINDEX TABLE products;
REINDEX TABLE categories;
```

## Monitoring Queries

### Check Query Performance

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%products%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Monitor Index Bloat

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'product_attributes')
ORDER BY pg_relation_size(indexrelid) DESC;
```

## References

- [Full Documentation](./DATABASE_OPTIMIZATION.md)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Query Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
