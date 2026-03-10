# Cache Service Documentation

## Overview

The Cache Service provides a comprehensive Redis-based caching layer for the Mall Admin application. It implements best practices for caching including cache-aside pattern, TTL management, batch operations, and cache invalidation strategies.

## Features

- **Type-safe caching**: Full TypeScript support with generic types
- **TTL management**: Configurable TTL by data type
- **Cache key conventions**: Structured naming for easy management
- **Batch operations**: Efficient multi-get and multi-set operations
- **Cache-aside pattern**: Built-in helper for lazy loading
- **Invalidation patterns**: Tag-based and pattern-based invalidation
- **Statistics tracking**: Monitor cache hit rates and performance
- **Error handling**: Graceful degradation on Redis failures

## Installation

The cache service is automatically initialized when the application starts. Ensure Redis is running and configured in your environment variables:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

## Basic Usage

### Import the Service

```typescript
import cacheService, { CacheTTL, CachePrefix } from './services/cacheService';
```

### Get and Set Operations

```typescript
// Set a value with default TTL (1 hour)
await cacheService.set('product:123', productData);

// Set a value with custom TTL
await cacheService.set('product:123', productData, CacheTTL.PRODUCT_DETAIL);

// Get a value
const product = await cacheService.get<Product>('product:123');

// Delete a value
await cacheService.delete('product:123');
```

### Cache-Aside Pattern

The `getOrSet` method implements the cache-aside pattern automatically:

```typescript
const product = await cacheService.getOrSet(
  'product:123',
  async () => {
    // This function is only called if cache misses
    return await database.products.findById('123');
  },
  CacheTTL.PRODUCT_DETAIL
);
```

### Batch Operations

```typescript
// Get multiple values at once
const products = await cacheService.mget<Product>([
  'product:1',
  'product:2',
  'product:3'
]);

// Set multiple values at once
await cacheService.mset([
  { key: 'product:1', value: product1, ttl: CacheTTL.PRODUCT_DETAIL },
  { key: 'product:2', value: product2, ttl: CacheTTL.PRODUCT_DETAIL },
  { key: 'product:3', value: product3, ttl: CacheTTL.PRODUCT_DETAIL },
]);
```

## Cache Key Naming Conventions

Cache keys follow a structured format: `{namespace}:{entity}:{id}:{suffix}`

### Examples

```typescript
// Product keys
product:123                           // Product detail
product:list:page:1:limit:20         // Product list
product:list:page:1:limit:20:status:active  // Filtered product list

// Order keys
order:456                            // Order detail
order:list:user123:page:1:limit:20   // User's orders

// User keys
user:789                             // User profile
user:789:permissions                 // User permissions
session:abc123                       // User session

// Marketing keys
flash_sale:active                    // Active flash sales
coupon:SAVE20                        // Coupon validation
recommendation:featured              // Featured recommendations
```

## TTL Configuration

Different data types have different TTL values based on their update frequency:

```typescript
// Product data
CacheTTL.PRODUCT_DETAIL = 3600      // 1 hour
CacheTTL.PRODUCT_LIST = 300         // 5 minutes
CacheTTL.CATEGORY_LIST = 86400      // 24 hours
CacheTTL.BRAND_LIST = 86400         // 24 hours

// Order data
CacheTTL.ORDER_DETAIL = 600         // 10 minutes
CacheTTL.ORDER_LIST = 300           // 5 minutes
CacheTTL.ORDER_ANALYTICS = 300      // 5 minutes

// User data
CacheTTL.USER_SESSION = 900         // 15 minutes
CacheTTL.USER_PROFILE = 1800        // 30 minutes
CacheTTL.USER_PERMISSIONS = 3600    // 1 hour

// Marketing data
CacheTTL.FLASH_SALE = 60            // 1 minute
CacheTTL.COUPON_VALIDATION = 300    // 5 minutes
CacheTTL.RECOMMENDATION = 1800      // 30 minutes

// Authentication
CacheTTL.JWT_BLACKLIST = 900        // 15 minutes
CacheTTL.REFRESH_TOKEN = 604800     // 7 days
CacheTTL.IDEMPOTENCY_KEY = 86400    // 24 hours
```

## Cache Invalidation

### Pattern-Based Invalidation

```typescript
// Delete all keys matching a pattern
await cacheService.deletePattern('product:*');

// Invalidate multiple patterns at once
await cacheService.invalidate([
  'product:*',
  'category:*',
  'brand:*'
]);
```

### Helper Methods for Common Invalidations

```typescript
// Product invalidation
await cacheService.product.invalidateAll();        // All product cache
await cacheService.product.invalidateDetail('123'); // Specific product
await cacheService.product.invalidateLists();      // All product lists

// Order invalidation
await cacheService.order.invalidateAll();          // All order cache
await cacheService.order.invalidateDetail('456');  // Specific order
await cacheService.order.invalidateUserOrders('user123'); // User's orders

// Category invalidation
await cacheService.category.invalidateAll();       // All categories

// Brand invalidation
await cacheService.brand.invalidateAll();          // All brands

// Marketing invalidation
await cacheService.marketing.invalidateFlashSales(); // Flash sales
await cacheService.marketing.invalidateCoupons();    // Coupons
```

## Domain-Specific Helpers

The cache service provides domain-specific helpers for common operations:

### Product Cache

```typescript
// Get cache keys
const detailKey = cacheService.product.getDetail('123');
const listKey = cacheService.product.getList(1, 20, 'status:active');

// Invalidate
await cacheService.product.invalidateAll();
await cacheService.product.invalidateDetail('123');
await cacheService.product.invalidateLists();
```

### Order Cache

```typescript
// Get cache keys
const detailKey = cacheService.order.getDetail('order123');
const listKey = cacheService.order.getList('user123', 1, 20);
const analyticsKey = cacheService.order.getAnalytics('2024-01');

// Invalidate
await cacheService.order.invalidateAll();
await cacheService.order.invalidateDetail('order123');
await cacheService.order.invalidateUserOrders('user123');
```

### User Cache

```typescript
// Get cache keys
const profileKey = cacheService.user.getProfile('user123');
const permissionsKey = cacheService.user.getPermissions('user123');
const sessionKey = cacheService.user.getSession('session123');

// Invalidate
await cacheService.user.invalidateUser('user123');
```

### Marketing Cache

```typescript
// Get cache keys
const flashSaleKey = cacheService.marketing.getFlashSale('sale123');
const activeFlashSalesKey = cacheService.marketing.getActiveFlashSales();
const couponKey = cacheService.marketing.getCoupon('SAVE20');
const recommendationsKey = cacheService.marketing.getRecommendations('featured');

// Invalidate
await cacheService.marketing.invalidateFlashSales();
await cacheService.marketing.invalidateCoupons();
```

## Cache Statistics

Monitor cache performance with built-in statistics:

```typescript
// Get current statistics
const stats = cacheService.getStats();
console.log(stats);
// {
//   hits: 1250,
//   misses: 150,
//   sets: 200,
//   deletes: 50,
//   errors: 2,
//   hitRate: 0.893
// }

// Reset statistics
cacheService.resetStats();
```

## Advanced Operations

### Check Key Existence

```typescript
const exists = await cacheService.exists('product:123');
```

### Get/Set TTL

```typescript
// Get remaining TTL
const ttl = await cacheService.getTTL('product:123');

// Update TTL
await cacheService.setTTL('product:123', 7200);
```

### Flush All Cache

**Use with caution!** This deletes all cached data:

```typescript
await cacheService.flushAll();
```

## Best Practices

### 1. Use Appropriate TTL Values

Choose TTL based on data update frequency:
- **Frequently changing data** (flash sales, stock): Short TTL (1-5 minutes)
- **Moderately changing data** (products, orders): Medium TTL (10-60 minutes)
- **Rarely changing data** (categories, brands): Long TTL (hours to days)

### 2. Invalidate on Updates

Always invalidate cache when data changes:

```typescript
async function updateProduct(id: string, data: UpdateProductData) {
  // Update database
  const product = await database.products.update(id, data);
  
  // Invalidate cache
  await cacheService.product.invalidateDetail(id);
  await cacheService.product.invalidateLists();
  
  return product;
}
```

### 3. Use Cache-Aside Pattern

Let the cache service handle cache misses automatically:

```typescript
const product = await cacheService.getOrSet(
  cacheService.product.getDetail(id),
  () => database.products.findById(id),
  CacheTTL.PRODUCT_DETAIL
);
```

### 4. Batch Operations for Multiple Items

Use batch operations to reduce round trips:

```typescript
// Instead of multiple get calls
const products = await cacheService.mget(
  productIds.map(id => cacheService.product.getDetail(id))
);
```

### 5. Handle Cache Failures Gracefully

The cache service returns `null` on errors, allowing your application to continue:

```typescript
const cached = await cacheService.get('product:123');
if (cached) {
  return cached;
}
// Fallback to database
return await database.products.findById('123');
```

### 6. Monitor Cache Performance

Regularly check cache statistics to optimize TTL and invalidation strategies:

```typescript
// In a monitoring endpoint
app.get('/api/v1/cache/stats', (req, res) => {
  const stats = cacheService.getStats();
  res.json(stats);
});
```

## Integration Examples

### Product Service Integration

```typescript
class ProductService {
  async getProduct(id: string): Promise<Product> {
    return await cacheService.getOrSet(
      cacheService.product.getDetail(id),
      async () => {
        return await this.database.products.findById(id);
      },
      CacheTTL.PRODUCT_DETAIL
    );
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<Product> {
    const product = await this.database.products.update(id, data);
    
    // Invalidate related caches
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();
    
    return product;
  }

  async getProducts(page: number, limit: number, filters?: any): Promise<Product[]> {
    const cacheKey = cacheService.product.getList(
      page,
      limit,
      filters ? JSON.stringify(filters) : ''
    );

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await this.database.products.findMany({ page, limit, filters });
      },
      CacheTTL.PRODUCT_LIST
    );
  }
}
```

### Order Service Integration

```typescript
class OrderService {
  async getOrder(id: string): Promise<Order> {
    return await cacheService.getOrSet(
      cacheService.order.getDetail(id),
      async () => {
        return await this.database.orders.findById(id);
      },
      CacheTTL.ORDER_DETAIL
    );
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.database.orders.updateStatus(id, status);
    
    // Invalidate order cache
    await cacheService.order.invalidateDetail(id);
    
    // Invalidate user's order list
    await cacheService.order.invalidateUserOrders(order.userId);
    
    return order;
  }
}
```

## Troubleshooting

### Cache Not Working

1. **Check Redis connection**: Ensure Redis is running and accessible
2. **Check environment variables**: Verify Redis configuration in `.env`
3. **Check logs**: Look for Redis connection errors in application logs

### High Cache Miss Rate

1. **Check TTL values**: May be too short for your use case
2. **Check invalidation patterns**: May be too aggressive
3. **Monitor access patterns**: Adjust caching strategy based on actual usage

### Memory Issues

1. **Review TTL values**: Reduce TTL for less critical data
2. **Implement cache size limits**: Use Redis maxmemory policies
3. **Monitor cache statistics**: Identify and optimize high-volume keys

## Performance Considerations

- **Connection pooling**: Redis client uses connection pooling automatically
- **Pipeline operations**: Batch operations use Redis pipelines for efficiency
- **Serialization**: JSON serialization is used for simplicity; consider MessagePack for better performance
- **Key naming**: Use consistent, predictable key patterns for efficient invalidation

## Security Considerations

- **Sensitive data**: Don't cache sensitive data without encryption
- **TTL for auth tokens**: Use appropriate TTL for JWT blacklist and refresh tokens
- **Access control**: Ensure cache keys don't leak sensitive information
- **Redis password**: Always use password authentication in production

## Monitoring and Metrics

Expose cache metrics for monitoring:

```typescript
// Prometheus metrics example
import { Gauge, Counter } from 'prom-client';

const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits'
});

const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses'
});

const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage'
});

// Update metrics periodically
setInterval(() => {
  const stats = cacheService.getStats();
  cacheHitRate.set(stats.hitRate * 100);
}, 60000);
```

## References

- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis Node.js Client](https://github.com/redis/node-redis)
