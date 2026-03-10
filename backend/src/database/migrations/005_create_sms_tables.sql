-- SMS (Sales & Marketing System) Tables Migration
-- Creates tables for flash sales, coupons, recommendations, and advertisements

-- Flash Sales Table
CREATE TABLE IF NOT EXISTS flash_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    discount_type VARCHAR(50) NOT NULL, -- 'percentage' or 'fixed'
    discount_value DECIMAL(10, 2) NOT NULL,
    max_quantity INTEGER,
    sold_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_discount CHECK (discount_value > 0)
);

-- Flash Sale Products (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS flash_sale_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flash_sale_id UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    original_price DECIMAL(10, 2) NOT NULL,
    sale_price DECIMAL(10, 2) NOT NULL,
    stock_limit INTEGER,
    sold_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flash_sale_id, product_id),
    CONSTRAINT valid_sale_price CHECK (sale_price < original_price)
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'free_shipping'
    discount_value DECIMAL(10, 2),
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_coupon_dates CHECK (end_date > start_date)
);

-- Coupon Usage Records
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, order_id)
);

-- Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'banner', 'featured', 'new_arrival', 'best_seller', 'hot_deal'
    position VARCHAR(50) NOT NULL, -- 'home_top', 'home_middle', 'category_top', etc.
    priority INTEGER DEFAULT 0,
    link_url VARCHAR(500),
    image_url VARCHAR(500),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendation Products (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS recommendation_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recommendation_id, product_id)
);

-- Advertisements Table
CREATE TABLE IF NOT EXISTS advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    position VARCHAR(50) NOT NULL, -- 'top_banner', 'sidebar', 'popup', 'footer'
    type VARCHAR(50) NOT NULL DEFAULT 'image', -- 'image', 'video', 'html'
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_ad_dates CHECK (end_date > start_date)
);

-- Create Indexes for Performance
CREATE INDEX idx_flash_sales_status ON flash_sales(status);
CREATE INDEX idx_flash_sales_time ON flash_sales(start_time, end_time);
CREATE INDEX idx_flash_sales_active ON flash_sales(is_active);

CREATE INDEX idx_flash_sale_products_sale ON flash_sale_products(flash_sale_id);
CREATE INDEX idx_flash_sale_products_product ON flash_sale_products(product_id);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);
CREATE INDEX idx_coupons_dates ON coupons(start_date, end_date);

CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX idx_coupon_usage_order ON coupon_usage(order_id);

CREATE INDEX idx_recommendations_type ON recommendations(type);
CREATE INDEX idx_recommendations_position ON recommendations(position);
CREATE INDEX idx_recommendations_active ON recommendations(is_active);
CREATE INDEX idx_recommendations_priority ON recommendations(priority DESC);

CREATE INDEX idx_recommendation_products_rec ON recommendation_products(recommendation_id);
CREATE INDEX idx_recommendation_products_product ON recommendation_products(product_id);

CREATE INDEX idx_advertisements_position ON advertisements(position);
CREATE INDEX idx_advertisements_active ON advertisements(is_active);
CREATE INDEX idx_advertisements_dates ON advertisements(start_date, end_date);
CREATE INDEX idx_advertisements_priority ON advertisements(priority DESC);

-- Add Comments
COMMENT ON TABLE flash_sales IS 'Flash sale campaigns with time-limited discounts';
COMMENT ON TABLE flash_sale_products IS 'Products included in flash sales';
COMMENT ON TABLE coupons IS 'Discount coupons for orders';
COMMENT ON TABLE coupon_usage IS 'Tracking coupon usage by users';
COMMENT ON TABLE recommendations IS 'Product recommendations and featured content';
COMMENT ON TABLE recommendation_products IS 'Products in recommendation lists';
COMMENT ON TABLE advertisements IS 'Marketing advertisements and banners';
