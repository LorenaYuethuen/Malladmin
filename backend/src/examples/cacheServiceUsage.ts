/**
 * Cache Service Usage Examples
 * 
 * This file demonstrates how to use the cache service in various scenarios.
 * These examples are for reference and should not be executed directly.
 */

import cacheService, { CacheTTL } from '../services/cacheService';

// ============================================================================
// Example 1: Basic Get/Set Operations
// ============================================================================

async function basicCacheExample() {
  // Set a value with default TTL (1 hour)
  await cacheService.set('user:123', {
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
  });

  // Get a value
  const user = await cacheService.get<{ id: string; name: string; email: string }>('user:123');
  console.log(user);

  // Delete a value
  await cacheService.delete('user:123');
}

// ============================================================================
// Example 2: Cache-Aside Pattern (Recommended)
// ============================================================================

async function cacheAsideExample(productId: string) {
  // This is the recommended pattern for caching
  // It automatically handles cache misses and updates
  const product = await cacheService.getOrSet(
    cacheService.product.getDetail(productId),
    async () => {
      // This function is only called if cache misses
      // Fetch from database
      return await database.products.findById(productId);
    },
    CacheTTL.PRODUCT_DETAIL
  );

  return product;
}

// ============================================================================
// Example 3: Product Service Integration
// ============================================================================

class ProductService {
  async getProduct(id: string) {
    return await cacheService.getOrSet(
      cacheService.product.getDetail(id),
      async () => {
        // Fetch from database
        const product = await this.database.products.findById(id);
        return product;
      },
      CacheTTL.PRODUCT_DETAIL
    );
  }

  async getProducts(page: number, limit: number, filters?: any) {
    const cacheKey = cacheService.product.getList(
      page,
      limit,
      filters ? JSON.stringify(filters) : ''
    );

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Fetch from database
        const products = await this.database.products.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where: filters,
        });
        return products;
      },
      CacheTTL.PRODUCT_LIST
    );
  }

  async updateProduct(id: string, data: any) {
    // Update database
    const product = await this.database.products.update(id, data);

    // Invalidate related caches
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();

    return product;
  }

  async deleteProduct(id: string) {
    // Delete from database
    await this.database.products.delete(id);

    // Invalidate related caches
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();
  }

  private database = {
    products: {
      findById: async (id: string) => ({ id, name: 'Product' }),
      findMany: async (options: any) => [],
      update: async (id: string, data: any) => ({ id, ...data }),
      delete: async (id: string) => {},
    },
  };
}

// ============================================================================
// Example 4: Order Service Integration
// ============================================================================

class OrderService {
  async getOrder(id: string) {
    return await cacheService.getOrSet(
      cacheService.order.getDetail(id),
      async () => {
        const order = await this.database.orders.findById(id);
        return order;
      },
      CacheTTL.ORDER_DETAIL
    );
  }

  async getUserOrders(userId: string, page: number, limit: number) {
    const cacheKey = cacheService.order.getList(userId, page, limit);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const orders = await this.database.orders.findMany({
          where: { userId },
          skip: (page - 1) * limit,
          take: limit,
        });
        return orders;
      },
      CacheTTL.ORDER_LIST
    );
  }

  async updateOrderStatus(id: string, status: string) {
    // Update database
    const order = await this.database.orders.updateStatus(id, status);

    // Invalidate order cache
    await cacheService.order.invalidateDetail(id);

    // Invalidate user's order list
    await cacheService.order.invalidateUserOrders(order.userId);

    return order;
  }

  async getOrderAnalytics(dateRange: string) {
    const cacheKey = cacheService.order.getAnalytics(dateRange);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const analytics = await this.database.orders.getAnalytics(dateRange);
        return analytics;
      },
      CacheTTL.ORDER_ANALYTICS
    );
  }

  private database = {
    orders: {
      findById: async (id: string) => ({ id, userId: 'user123', status: 'pending' }),
      findMany: async (options: any) => [],
      updateStatus: async (id: string, status: string) => ({
        id,
        userId: 'user123',
        status,
      }),
      getAnalytics: async (dateRange: string) => ({ totalOrders: 100, revenue: 10000 }),
    },
  };
}

// ============================================================================
// Example 5: Batch Operations
// ============================================================================

async function batchOperationsExample() {
  // Get multiple products at once
  const productIds = ['1', '2', '3', '4', '5'];
  const cacheKeys = productIds.map((id) => cacheService.product.getDetail(id));

  const cachedProducts = await cacheService.mget(cacheKeys);

  // Find which products are not in cache
  const missingIds = productIds.filter((id, index) => cachedProducts[index] === null);

  if (missingIds.length > 0) {
    // Fetch missing products from database
    const missingProducts = await database.products.findMany({
      where: { id: { in: missingIds } },
    });

    // Cache the missing products
    await cacheService.mset(
      missingProducts.map((product: any) => ({
        key: cacheService.product.getDetail(product.id),
        value: product,
        ttl: CacheTTL.PRODUCT_DETAIL,
      }))
    );
  }

  // Combine cached and fetched products
  const allProducts = cachedProducts.map((product, index) => {
    if (product) return product;
    // Find in fetched products
    return null; // Replace with actual logic
  });

  return allProducts;
}

// ============================================================================
// Example 6: Session Management
// ============================================================================

async function sessionManagementExample() {
  // Store user session
  const sessionId = 'session_abc123';
  const sessionData = {
    userId: 'user123',
    email: 'user@example.com',
    roles: ['user', 'admin'],
    loginAt: new Date().toISOString(),
  };

  await cacheService.set(
    cacheService.user.getSession(sessionId),
    sessionData,
    CacheTTL.USER_SESSION
  );

  // Get user session
  const session = await cacheService.get(cacheService.user.getSession(sessionId));

  // Delete session (logout)
  await cacheService.delete(cacheService.user.getSession(sessionId));
}

// ============================================================================
// Example 7: Flash Sale with Short TTL
// ============================================================================

async function flashSaleExample() {
  // Cache active flash sales with short TTL (1 minute)
  const activeFlashSales = await cacheService.getOrSet(
    cacheService.marketing.getActiveFlashSales(),
    async () => {
      const sales = await database.flashSales.findActive();
      return sales;
    },
    CacheTTL.FLASH_SALE
  );

  return activeFlashSales;
}

// ============================================================================
// Example 8: Coupon Validation
// ============================================================================

async function couponValidationExample(couponCode: string) {
  // Cache coupon validation results
  const coupon = await cacheService.getOrSet(
    cacheService.marketing.getCoupon(couponCode),
    async () => {
      const couponData = await database.coupons.findByCode(couponCode);
      return couponData;
    },
    CacheTTL.COUPON_VALIDATION
  );

  return coupon;
}

// ============================================================================
// Example 9: Cache Invalidation Patterns
// ============================================================================

async function cacheInvalidationExample() {
  // Invalidate specific product
  await cacheService.product.invalidateDetail('123');

  // Invalidate all product lists
  await cacheService.product.invalidateLists();

  // Invalidate all product cache
  await cacheService.product.invalidateAll();

  // Invalidate multiple patterns at once
  await cacheService.invalidate(['product:*', 'category:*', 'brand:*']);

  // Invalidate user's orders
  await cacheService.order.invalidateUserOrders('user123');
}

// ============================================================================
// Example 10: Cache Statistics Monitoring
// ============================================================================

async function cacheStatisticsExample() {
  // Get cache statistics
  const stats = cacheService.getStats();
  console.log('Cache Statistics:', {
    hits: stats.hits,
    misses: stats.misses,
    sets: stats.sets,
    deletes: stats.deletes,
    errors: stats.errors,
    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
  });

  // Reset statistics (useful for testing)
  cacheService.resetStats();
}

// ============================================================================
// Example 11: Express Middleware for Caching
// ============================================================================

import { Request, Response, NextFunction } from 'express';

function cacheMiddleware(ttl: number = CacheTTL.DEFAULT) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `api:${req.path}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data: any) {
      // Cache the response
      cacheService.set(cacheKey, data, ttl);
      return originalJson(data);
    };

    next();
  };
}

// Usage in Express routes
// app.get('/api/v1/products', cacheMiddleware(CacheTTL.PRODUCT_LIST), getProducts);

// ============================================================================
// Example 12: Advanced TTL Management
// ============================================================================

async function advancedTTLExample() {
  const key = 'product:123';

  // Set value with custom TTL
  await cacheService.set(key, { id: '123', name: 'Product' }, 7200); // 2 hours

  // Check remaining TTL
  const ttl = await cacheService.getTTL(key);
  console.log(`Remaining TTL: ${ttl} seconds`);

  // Update TTL without changing value
  await cacheService.setTTL(key, 3600); // Extend to 1 hour

  // Check if key exists
  const exists = await cacheService.exists(key);
  console.log(`Key exists: ${exists}`);
}

// ============================================================================
// Mock database for examples
// ============================================================================

const database = {
  products: {
    findById: async (id: string) => ({ id, name: 'Product', price: 99.99 }),
    findMany: async (options: any) => [],
  },
  flashSales: {
    findActive: async () => [],
  },
  coupons: {
    findByCode: async (code: string) => ({ code, discount: 10 }),
  },
};

// Export examples for reference
export {
  basicCacheExample,
  cacheAsideExample,
  ProductService,
  OrderService,
  batchOperationsExample,
  sessionManagementExample,
  flashSaleExample,
  couponValidationExample,
  cacheInvalidationExample,
  cacheStatisticsExample,
  cacheMiddleware,
  advancedTTLExample,
};
