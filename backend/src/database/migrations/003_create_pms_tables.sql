-- ============================================================================
-- Product Management System (PMS) Database Schema
-- ============================================================================
-- This migration creates all tables required for the Product Management System
-- including products, categories, brands, attributes, inventory, and SEO data.
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

-- ============================================================================
-- 1. CATEGORIES TABLE - Hierarchical category structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  path TEXT, -- Materialized path for efficient tree queries (e.g., '/1/2/3/')
  level INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  icon VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- ============================================================================
-- 2. BRANDS TABLE - Brand information
-- ============================================================================
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for brands
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON brands(sort_order);

-- ============================================================================
-- 3. ATTRIBUTES TABLE - Product attributes (size, color, material, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'select', 'multiselect', 'color', 'number', 'boolean')),
  options JSONB, -- For select/multiselect types: [{"value": "red", "label": "Red"}, ...]
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for attributes
CREATE INDEX IF NOT EXISTS idx_attributes_slug ON attributes(slug);
CREATE INDEX IF NOT EXISTS idx_attributes_type ON attributes(type);
CREATE INDEX IF NOT EXISTS idx_attributes_filterable ON attributes(is_filterable);
CREATE INDEX IF NOT EXISTS idx_attributes_sort_order ON attributes(sort_order);

-- ============================================================================
-- 4. PRODUCTS TABLE - Main product table
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL UNIQUE,
  sku VARCHAR(100) NOT NULL UNIQUE,
  barcode VARCHAR(100),
  description TEXT,
  short_description TEXT,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  sale_price DECIMAL(10, 2) CHECK (sale_price >= 0),
  cost_price DECIMAL(10, 2) CHECK (cost_price >= 0),
  
  -- Relationships
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  
  -- Status and visibility
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'hidden')),
  
  -- Product type
  product_type VARCHAR(50) NOT NULL DEFAULT 'simple' CHECK (product_type IN ('simple', 'variable', 'grouped', 'virtual', 'downloadable')),
  
  -- Shipping
  weight DECIMAL(10, 2), -- in kg
  length DECIMAL(10, 2), -- in cm
  width DECIMAL(10, 2), -- in cm
  height DECIMAL(10, 2), -- in cm
  
  -- Flags
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  is_on_sale BOOLEAN NOT NULL DEFAULT FALSE,
  allow_backorder BOOLEAN NOT NULL DEFAULT FALSE,
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Ratings and reviews
  rating_average DECIMAL(3, 2) DEFAULT 0 CHECK (rating_average >= 0 AND rating_average <= 5),
  rating_count INTEGER DEFAULT 0 CHECK (rating_count >= 0),
  review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
  
  -- Sales metrics
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
  sales_count INTEGER DEFAULT 0 CHECK (sales_count >= 0),
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_sale_price ON products(sale_price) WHERE sale_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new) WHERE is_new = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_is_on_sale ON products(is_on_sale) WHERE is_on_sale = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_products_sales_count ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_published_at ON products(published_at DESC) WHERE published_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_brand_status ON products(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_visibility ON products(status, visibility);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(
  to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(sku, ''))
);

-- ============================================================================
-- 5. PRODUCT_ATTRIBUTES TABLE - Junction table for product attributes
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, attribute_id)
);

-- Indexes for product_attributes
CREATE INDEX IF NOT EXISTS idx_product_attributes_product_id ON product_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_attribute_id ON product_attributes(attribute_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_value ON product_attributes(value);

-- ============================================================================
-- 6. PRODUCT_IMAGES TABLE - Product images
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text VARCHAR(255),
  title VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  file_size INTEGER, -- in bytes
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for product_images
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_is_primary ON product_images(product_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_images_sort_order ON product_images(product_id, sort_order);

-- ============================================================================
-- 7. PRODUCT_INVENTORY TABLE - Inventory tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  is_in_stock BOOLEAN GENERATED ALWAYS AS (quantity - reserved_quantity > 0) STORED,
  is_low_stock BOOLEAN GENERATED ALWAYS AS (quantity - reserved_quantity <= low_stock_threshold AND quantity - reserved_quantity > 0) STORED,
  last_restocked_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for product_inventory
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_quantity ON product_inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_product_inventory_available ON product_inventory(available_quantity);
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock ON product_inventory(is_low_stock) WHERE is_low_stock = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_inventory_out_of_stock ON product_inventory(is_in_stock) WHERE is_in_stock = FALSE;

-- ============================================================================
-- 8. PRODUCT_SEO TABLE - SEO metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  og_title VARCHAR(255),
  og_description TEXT,
  og_image_url TEXT,
  canonical_url TEXT,
  robots VARCHAR(100), -- e.g., 'index,follow' or 'noindex,nofollow'
  structured_data JSONB, -- JSON-LD structured data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for product_seo
CREATE INDEX IF NOT EXISTS idx_product_seo_product_id ON product_seo(product_id);

-- ============================================================================
-- TRIGGERS - Auto-update timestamps
-- ============================================================================

-- Trigger for categories
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for brands
CREATE TRIGGER update_brands_updated_at 
  BEFORE UPDATE ON brands
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for attributes
CREATE TRIGGER update_attributes_updated_at 
  BEFORE UPDATE ON attributes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for products
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product_inventory
CREATE TRIGGER update_product_inventory_updated_at 
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product_seo
CREATE TRIGGER update_product_seo_updated_at 
  BEFORE UPDATE ON product_seo
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS - Helper functions for PMS
-- ============================================================================

-- Function to update category path when parent changes
CREATE OR REPLACE FUNCTION update_category_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path = '/' || NEW.id::TEXT || '/';
    NEW.level = 0;
  ELSE
    SELECT path || NEW.id::TEXT || '/', level + 1
    INTO NEW.path, NEW.level
    FROM categories
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_path();

-- Function to automatically set is_on_sale flag
CREATE OR REPLACE FUNCTION update_product_sale_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_price IS NOT NULL AND NEW.sale_price < NEW.price THEN
    NEW.is_on_sale = TRUE;
  ELSE
    NEW.is_on_sale = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_sale_flag_trigger
  BEFORE INSERT OR UPDATE OF price, sale_price ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_sale_flag();

-- ============================================================================
-- COMMENTS - Table and column documentation
-- ============================================================================

COMMENT ON TABLE categories IS 'Hierarchical product categories with materialized path';
COMMENT ON COLUMN categories.path IS 'Materialized path for efficient tree queries (e.g., /1/2/3/)';
COMMENT ON COLUMN categories.level IS 'Depth level in the category tree (0 = root)';

COMMENT ON TABLE brands IS 'Product brands and manufacturers';

COMMENT ON TABLE attributes IS 'Product attributes like size, color, material, etc.';
COMMENT ON COLUMN attributes.type IS 'Attribute type: text, select, multiselect, color, number, boolean';
COMMENT ON COLUMN attributes.options IS 'JSON array of options for select/multiselect types';

COMMENT ON TABLE products IS 'Main product catalog table';
COMMENT ON COLUMN products.product_type IS 'Product type: simple, variable, grouped, virtual, downloadable';
COMMENT ON COLUMN products.status IS 'Product status: draft, active, inactive, archived';
COMMENT ON COLUMN products.visibility IS 'Product visibility: public, private, hidden';

COMMENT ON TABLE product_attributes IS 'Junction table linking products to their attribute values';

COMMENT ON TABLE product_images IS 'Product images with ordering and metadata';

COMMENT ON TABLE product_inventory IS 'Real-time inventory tracking with reserved quantities';
COMMENT ON COLUMN product_inventory.quantity IS 'Total quantity in stock';
COMMENT ON COLUMN product_inventory.reserved_quantity IS 'Quantity reserved for pending orders';
COMMENT ON COLUMN product_inventory.available_quantity IS 'Computed: quantity - reserved_quantity';

COMMENT ON TABLE product_seo IS 'SEO metadata for products including Open Graph and structured data';

-- ============================================================================
-- SEED DATA - Sample data for testing
-- ============================================================================

-- Insert sample categories
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES
  ('Electronics', 'electronics', 'Electronic devices and accessories', NULL, 1),
  ('Clothing', 'clothing', 'Apparel and fashion items', NULL, 2),
  ('Home & Garden', 'home-garden', 'Home improvement and garden supplies', NULL, 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample brands
INSERT INTO brands (name, slug, description, sort_order) VALUES
  ('TechBrand', 'techbrand', 'Leading technology brand', 1),
  ('FashionCo', 'fashionco', 'Premium fashion brand', 2),
  ('HomeStyle', 'homestyle', 'Modern home furnishings', 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample attributes
INSERT INTO attributes (name, slug, type, options, is_filterable, sort_order) VALUES
  ('Color', 'color', 'select', '[{"value": "red", "label": "Red"}, {"value": "blue", "label": "Blue"}, {"value": "green", "label": "Green"}, {"value": "black", "label": "Black"}, {"value": "white", "label": "White"}]'::jsonb, TRUE, 1),
  ('Size', 'size', 'select', '[{"value": "xs", "label": "XS"}, {"value": "s", "label": "S"}, {"value": "m", "label": "M"}, {"value": "l", "label": "L"}, {"value": "xl", "label": "XL"}]'::jsonb, TRUE, 2),
  ('Material', 'material', 'select', '[{"value": "cotton", "label": "Cotton"}, {"value": "polyester", "label": "Polyester"}, {"value": "leather", "label": "Leather"}, {"value": "metal", "label": "Metal"}]'::jsonb, TRUE, 3),
  ('Weight', 'weight', 'number', NULL, FALSE, 4),
  ('Warranty', 'warranty', 'text', NULL, FALSE, 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration creates a comprehensive Product Management System schema
-- with support for:
-- - Hierarchical categories with materialized paths
-- - Brand management
-- - Flexible product attributes
-- - Multiple product images
-- - Real-time inventory tracking with reservations
-- - SEO optimization
-- - Full-text search
-- - Audit trails
-- ============================================================================
