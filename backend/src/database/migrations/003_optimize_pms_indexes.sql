-- ============================================================================
-- PMS Database Performance Optimization
-- ============================================================================
-- This migration optimizes the Product Management System database with:
-- - Composite indexes for common query patterns
-- - Enhanced full-text search indexes
-- - Covering indexes for frequently accessed columns
-- - Category tree query optimization
-- - Price range filtering optimization
-- Requirements: 9.2, 9.3

-- ============================================================================
-- 1. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Products: Common filtering combinations
-- Query: Get active products by category
CREATE INDEX IF NOT EXISTS idx_products_category_status_active 
  ON products(category_id, status) 
  WHERE status = 'active';

-- Query: Get active products by brand
CREATE INDEX IF NOT EXISTS idx_products_brand_status_active 
  ON products(brand_id, status) 
  WHERE status = 'active';

-- Query: Get products by category and brand (filtered by status)
CREATE INDEX IF NOT EXISTS idx_products_category_brand_status 
  ON products(category_id, brand_id, status);

-- Query: Get featured products by category
CREATE INDEX IF NOT EXISTS idx_products_category_featured 
  ON products(category_id, is_featured, status) 
  WHERE is_featured = TRUE AND status = 'active';

-- Query: Get new products by category
CREATE INDEX IF NOT EXISTS idx_products_category_new 
  ON products(category_id, is_new, created_at DESC) 
  WHERE is_new = TRUE AND status = 'active';

-- Query: Get on-sale products by category
CREATE INDEX IF NOT EXISTS idx_products_category_sale 
  ON products(category_id, is_on_sale, sale_price) 
  WHERE is_on_sale = TRUE AND status = 'active';

-- ============================================================================
-- 2. PRICE RANGE FILTERING OPTIMIZATION
-- ============================================================================

-- Query: Filter products by price range (most common e-commerce query)
CREATE INDEX IF NOT EXISTS idx_products_price_range 
  ON products(price, status, category_id) 
  WHERE status = 'active';

-- Query: Filter products by sale price range
CREATE INDEX IF NOT EXISTS idx_products_sale_price_range 
  ON products(sale_price, status, category_id) 
  WHERE sale_price IS NOT NULL AND status = 'active';

-- Query: Get products sorted by price (ascending)
CREATE INDEX IF NOT EXISTS idx_products_price_asc 
  ON products(price ASC, id) 
  WHERE status = 'active';

-- Query: Get products sorted by price (descending)
CREATE INDEX IF NOT EXISTS idx_products_price_desc 
  ON products(price DESC, id) 
  WHERE status = 'active';

-- ============================================================================
-- 3. COVERING INDEXES FOR FREQUENTLY ACCESSED COLUMNS
-- ============================================================================

-- Covering index for product list queries (includes commonly displayed fields)
-- This allows index-only scans without touching the table
CREATE INDEX IF NOT EXISTS idx_products_list_covering 
  ON products(status, category_id, created_at DESC) 
  INCLUDE (id, name, slug, price, sale_price, is_featured, is_on_sale, rating_average);

-- Covering index for product search results
CREATE INDEX IF NOT EXISTS idx_products_search_covering 
  ON products(status) 
  INCLUDE (id, name, slug, price, sale_price, category_id, brand_id, rating_average, sales_count)
  WHERE status = 'active';

-- Covering index for brand product listings
CREATE INDEX IF NOT EXISTS idx_products_brand_covering 
  ON products(brand_id, status, created_at DESC) 
  INCLUDE (id, name, slug, price, sale_price, rating_average);

-- ============================================================================
-- 4. ENHANCED FULL-TEXT SEARCH INDEXES
-- ============================================================================

-- Drop existing basic full-text search index
DROP INDEX IF EXISTS idx_products_search;

-- Enhanced full-text search with weighted fields (name has higher weight)
CREATE INDEX IF NOT EXISTS idx_products_fulltext_weighted 
  ON products USING GIN(
    (
      setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(short_description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
      setweight(to_tsvector('english', COALESCE(sku, '')), 'D')
    )
  )
  WHERE status = 'active';

-- Trigram index for fuzzy/partial matching (e.g., autocomplete)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON products USING GIN(name gin_trgm_ops) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm 
  ON products USING GIN(sku gin_trgm_ops);

-- ============================================================================
-- 5. CATEGORY TREE QUERY OPTIMIZATION
-- ============================================================================

-- Optimized index for finding all descendants of a category
-- Uses the materialized path pattern
CREATE INDEX IF NOT EXISTS idx_categories_path_descendants 
  ON categories(path text_pattern_ops, is_active);

-- Index for finding direct children of a category
CREATE INDEX IF NOT EXISTS idx_categories_parent_active 
  ON categories(parent_id, is_active, sort_order) 
  WHERE is_active = TRUE;

-- Index for breadcrumb navigation (path lookup)
CREATE INDEX IF NOT EXISTS idx_categories_path_lookup 
  ON categories USING GIST(path gist_trgm_ops);

-- Covering index for category tree rendering
CREATE INDEX IF NOT EXISTS idx_categories_tree_covering 
  ON categories(parent_id, sort_order, is_active) 
  INCLUDE (id, name, slug, level, path, icon);

-- ============================================================================
-- 6. INVENTORY OPTIMIZATION
-- ============================================================================

-- Index for low stock alerts
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock_alert 
  ON product_inventory(is_low_stock, product_id) 
  WHERE is_low_stock = TRUE;

-- Index for out of stock products
CREATE INDEX IF NOT EXISTS idx_inventory_out_of_stock_alert 
  ON product_inventory(is_in_stock, product_id) 
  WHERE is_in_stock = FALSE;

-- Covering index for inventory checks
CREATE INDEX IF NOT EXISTS idx_inventory_check_covering 
  ON product_inventory(product_id) 
  INCLUDE (quantity, reserved_quantity, available_quantity, is_in_stock);

-- ============================================================================
-- 7. RATING AND POPULARITY INDEXES
-- ============================================================================

-- Index for top-rated products
CREATE INDEX IF NOT EXISTS idx_products_top_rated 
  ON products(rating_average DESC, rating_count DESC, id) 
  WHERE status = 'active' AND rating_count >= 5;

-- Index for best-selling products
CREATE INDEX IF NOT EXISTS idx_products_best_selling 
  ON products(sales_count DESC, id) 
  WHERE status = 'active';

-- Index for trending products (recent sales + views)
CREATE INDEX IF NOT EXISTS idx_products_trending 
  ON products(view_count DESC, sales_count DESC, created_at DESC) 
  WHERE status = 'active' AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- ============================================================================
-- 8. ATTRIBUTE FILTERING OPTIMIZATION
-- ============================================================================

-- Index for filtering products by attribute values
CREATE INDEX IF NOT EXISTS idx_product_attributes_filter 
  ON product_attributes(attribute_id, value, product_id);

-- Covering index for attribute-based product filtering
CREATE INDEX IF NOT EXISTS idx_product_attributes_covering 
  ON product_attributes(attribute_id, value) 
  INCLUDE (product_id);

-- GIN index for JSONB attribute options (for complex attribute queries)
CREATE INDEX IF NOT EXISTS idx_attributes_options_gin 
  ON attributes USING GIN(options) 
  WHERE options IS NOT NULL;

-- ============================================================================
-- 9. BRAND OPTIMIZATION
-- ============================================================================

-- Covering index for brand listings with product counts
CREATE INDEX IF NOT EXISTS idx_brands_list_covering 
  ON brands(is_active, sort_order) 
  INCLUDE (id, name, slug, logo_url);

-- ============================================================================
-- 10. PERFORMANCE ANALYSIS HELPER FUNCTIONS
-- ============================================================================

-- Function to analyze product query performance
CREATE OR REPLACE FUNCTION analyze_product_query_performance()
RETURNS TABLE(
  index_name TEXT,
  index_size TEXT,
  table_size TEXT,
  index_scans BIGINT,
  tuples_read BIGINT,
  tuples_fetched BIGINT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    indexrelname::TEXT,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_size_pretty(pg_relation_size(indrelid)) AS table_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public' 
    AND indexrelname LIKE 'idx_products%'
  ORDER BY idx_scan DESC;
END;
$ LANGUAGE plpgsql;

-- Function to find unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
  schema_name TEXT,
  table_name TEXT,
  index_name TEXT,
  index_size TEXT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    schemaname::TEXT,
    tablename::TEXT,
    indexrelname::TEXT,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
  ORDER BY pg_relation_size(indexrelid) DESC;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. STATISTICS AND MAINTENANCE
-- ============================================================================

-- Update statistics for query planner optimization
ANALYZE products;
ANALYZE categories;
ANALYZE brands;
ANALYZE attributes;
ANALYZE product_attributes;
ANALYZE product_inventory;
ANALYZE product_images;

-- ============================================================================
-- COMMENTS - Index documentation
-- ============================================================================

COMMENT ON INDEX idx_products_category_status_active IS 'Optimized for active products by category queries';
COMMENT ON INDEX idx_products_brand_status_active IS 'Optimized for active products by brand queries';
COMMENT ON INDEX idx_products_price_range IS 'Optimized for price range filtering queries';
COMMENT ON INDEX idx_products_list_covering IS 'Covering index for product list queries (index-only scan)';
COMMENT ON INDEX idx_products_fulltext_weighted IS 'Weighted full-text search with name prioritization';
COMMENT ON INDEX idx_products_name_trgm IS 'Trigram index for fuzzy name matching and autocomplete';
COMMENT ON INDEX idx_categories_path_descendants IS 'Optimized for finding category descendants using materialized path';
COMMENT ON INDEX idx_categories_tree_covering IS 'Covering index for category tree rendering';
COMMENT ON INDEX idx_inventory_check_covering IS 'Covering index for inventory availability checks';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Performance optimizations applied:
-- ✓ Composite indexes for common query patterns
-- ✓ Enhanced full-text search with weighted fields
-- ✓ Trigram indexes for fuzzy matching
-- ✓ Covering indexes for index-only scans
-- ✓ Category tree optimization with materialized path
-- ✓ Price range filtering optimization
-- ✓ Inventory check optimization
-- ✓ Performance analysis helper functions
-- ============================================================================
