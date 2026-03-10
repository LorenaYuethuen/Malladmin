import { RedisClientType } from 'redis';
import redis from '../database/redis';
import logger from '../utils/logger';

/**
 * Cache key naming conventions
 * Format: {namespace}:{entity}:{id}:{suffix}
 * Examples:
 * - product:123
 * - product:list:page:1:limit:20
 * - user:session:abc123
 * - order:456:details
 */

/**
 * Cache TTL configuration by data type (in seconds)
 */
export const CacheTTL = {
  // Product data
  PRODUCT_DETAIL: 3600, // 1 hour
  PRODUCT_LIST: 300, // 5 minutes
  CATEGORY_DETAIL: 86400, // 24 hours
  CATEGORY_LIST: 86400, // 24 hours
  BRAND_DETAIL: 3600, // 1 hour
  BRAND_LIST: 86400, // 24 hours
  ATTRIBUTE_DETAIL: 3600, // 1 hour
  ATTRIBUTE_LIST: 86400, // 24 hours

  // Order data
  ORDER_DETAIL: 600, // 10 minutes
  ORDER_LIST: 300, // 5 minutes
  ORDER_ANALYTICS: 300, // 5 minutes

  // User data
  USER_SESSION: 900, // 15 minutes
  USER_PROFILE: 1800, // 30 minutes
  USER_PERMISSIONS: 3600, // 1 hour

  // Marketing data
  FLASH_SALE: 60, // 1 minute
  COUPON_VALIDATION: 300, // 5 minutes
  RECOMMENDATION: 1800, // 30 minutes
  ADVERTISEMENT: 600, // 10 minutes

  // Authentication
  JWT_BLACKLIST: 900, // 15 minutes
  REFRESH_TOKEN: 604800, // 7 days
  IDEMPOTENCY_KEY: 86400, // 24 hours

  // Rate limiting
  RATE_LIMIT: 900, // 15 minutes

  // Default
  DEFAULT: 3600, // 1 hour
} as const;

/**
 * Cache key prefixes for different data types
 */
export const CachePrefix = {
  PRODUCT: 'product',
  CATEGORY: 'category',
  BRAND: 'brand',
  ATTRIBUTE: 'attribute',
  ORDER: 'order',
  USER: 'user',
  SESSION: 'session',
  FLASH_SALE: 'flash_sale',
  COUPON: 'coupon',
  RECOMMENDATION: 'recommendation',
  ADVERTISEMENT: 'advertisement',
  JWT_BLACKLIST: 'jwt_blacklist',
  REFRESH_TOKEN: 'refresh_token',
  IDEMPOTENCY: 'idempotency',
  RATE_LIMIT: 'rate_limit',
  ANALYTICS: 'analytics',
} as const;

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

/**
 * Cache service wrapper with advanced caching operations
 */
class CacheService {
  private client: RedisClientType;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
  };

  constructor() {
    this.client = redis.getClient();
  }

  /**
   * Build cache key with namespace
   */
  private buildKey(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].filter(Boolean).join(':');
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value) {
        this.stats.hits++;
        this.updateHitRate();
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      this.updateHitRate();
      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl: number = CacheTTL.DEFAULT): Promise<boolean> {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      this.stats.sets++;
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      this.stats.deletes++;
      logger.debug(`Cache delete: ${key}`);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      const result = await this.client.del(keys);
      this.stats.deletes += keys.length;
      logger.debug(`Cache delete pattern: ${pattern} (${keys.length} keys)`);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Set TTL for existing key
   */
  async setTTL(key: string, ttl: number): Promise<boolean> {
    try {
      return await this.client.expire(key, ttl);
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache set TTL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values at once (batch operation)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      const values = await this.client.mGet(keys);
      return values.map((value) => {
        if (value) {
          this.stats.hits++;
          return JSON.parse(value) as T;
        }
        this.stats.misses++;
        return null;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache mget error:`, error);
      return keys.map(() => null);
    } finally {
      this.updateHitRate();
    }
  }

  /**
   * Set multiple values at once (batch operation)
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      // Use pipeline for atomic batch operations
      const pipeline = this.client.multi();
      
      for (const entry of entries) {
        const ttl = entry.ttl || CacheTTL.DEFAULT;
        pipeline.setEx(entry.key, ttl, JSON.stringify(entry.value));
      }
      
      await pipeline.exec();
      this.stats.sets += entries.length;
      logger.debug(`Cache mset: ${entries.length} keys`);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error(`Cache mset error:`, error);
      return false;
    }
  }

  /**
   * Cache-aside pattern helper
   * Get from cache or fetch from source and cache the result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CacheTTL.DEFAULT
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();
    
    // Cache the result
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Invalidate cache by tags/patterns
   * Useful for invalidating related cache entries
   */
  async invalidate(patterns: string[]): Promise<number> {
    let totalDeleted = 0;
    for (const pattern of patterns) {
      const deleted = await this.deletePattern(pattern);
      totalDeleted += deleted;
    }
    logger.info(`Cache invalidated: ${totalDeleted} keys across ${patterns.length} patterns`);
    return totalDeleted;
  }

  /**
   * Product cache helpers
   */
  product = {
    getDetail: (id: string) => this.buildKey(CachePrefix.PRODUCT, id),
    getList: (page: number, limit: number, filters?: string) =>
      this.buildKey(CachePrefix.PRODUCT, 'list', `page:${page}`, `limit:${limit}`, filters || ''),
    invalidateAll: () => this.deletePattern(`${CachePrefix.PRODUCT}:*`),
    invalidateDetail: (id: string) => this.delete(this.buildKey(CachePrefix.PRODUCT, id)),
    invalidateLists: () => this.deletePattern(`${CachePrefix.PRODUCT}:list:*`),
  };

  /**
   * Category cache helpers
   */
  category = {
    getDetail: (id: string) => this.buildKey(CachePrefix.CATEGORY, id),
    getList: (filters?: string) => this.buildKey(CachePrefix.CATEGORY, 'list', filters || ''),
    getTree: () => this.buildKey(CachePrefix.CATEGORY, 'tree'),
    invalidateAll: () => this.deletePattern(`${CachePrefix.CATEGORY}:*`),
    invalidateDetail: (id: string) => this.delete(this.buildKey(CachePrefix.CATEGORY, id)),
    invalidateLists: () => this.deletePattern(`${CachePrefix.CATEGORY}:list:*`),
  };

  /**
   * Brand cache helpers
   */
  brand = {
    getDetail: (id: string) => this.buildKey(CachePrefix.BRAND, id),
    getList: (page: number, limit: number, filters?: string) =>
      this.buildKey(CachePrefix.BRAND, 'list', `page:${page}`, `limit:${limit}`, filters || ''),
    invalidateAll: () => this.deletePattern(`${CachePrefix.BRAND}:*`),
    invalidateDetail: (id: string) => this.delete(this.buildKey(CachePrefix.BRAND, id)),
    invalidateLists: () => this.deletePattern(`${CachePrefix.BRAND}:list:*`),
  };

  /**
   * Attribute cache helpers
   */
  attribute = {
    getDetail: (id: string) => this.buildKey(CachePrefix.ATTRIBUTE, id),
    getList: (page: number, limit: number, filters?: string) =>
      this.buildKey(CachePrefix.ATTRIBUTE, 'list', `page:${page}`, `limit:${limit}`, filters || ''),
    invalidateAll: () => this.deletePattern(`${CachePrefix.ATTRIBUTE}:*`),
    invalidateDetail: (id: string) => this.delete(this.buildKey(CachePrefix.ATTRIBUTE, id)),
    invalidateLists: () => this.deletePattern(`${CachePrefix.ATTRIBUTE}:list:*`),
  };

  /**
   * Order cache helpers
   */
  order = {
    getDetail: (id: string) => this.buildKey(CachePrefix.ORDER, id),
    getList: (userId: string, page: number, limit: number) =>
      this.buildKey(CachePrefix.ORDER, 'list', userId, `page:${page}`, `limit:${limit}`),
    getAnalytics: (dateRange: string) =>
      this.buildKey(CachePrefix.ANALYTICS, 'orders', dateRange),
    invalidateAll: () => this.deletePattern(`${CachePrefix.ORDER}:*`),
    invalidateDetail: (id: string) => this.delete(this.buildKey(CachePrefix.ORDER, id)),
    invalidateUserOrders: (userId: string) =>
      this.deletePattern(`${CachePrefix.ORDER}:list:${userId}:*`),
  };

  /**
   * User cache helpers
   */
  user = {
    getProfile: (id: string) => this.buildKey(CachePrefix.USER, id),
    getPermissions: (id: string) => this.buildKey(CachePrefix.USER, id, 'permissions'),
    getSession: (sessionId: string) => this.buildKey(CachePrefix.SESSION, sessionId),
    invalidateUser: (id: string) => this.deletePattern(`${CachePrefix.USER}:${id}:*`),
  };

  /**
   * Marketing cache helpers
   */
  marketing = {
    getFlashSale: (id: string) => this.buildKey(CachePrefix.FLASH_SALE, id),
    getActiveFlashSales: () => this.buildKey(CachePrefix.FLASH_SALE, 'active'),
    getCoupon: (code: string) => this.buildKey(CachePrefix.COUPON, code),
    getRecommendations: (type: string) => this.buildKey(CachePrefix.RECOMMENDATION, type),
    invalidateFlashSales: () => this.deletePattern(`${CachePrefix.FLASH_SALE}:*`),
    invalidateCoupons: () => this.deletePattern(`${CachePrefix.COUPON}:*`),
  };

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Flush all cache (use with caution!)
   */
  async flushAll(): Promise<boolean> {
    try {
      await this.client.flushDb();
      logger.warn('Cache flushed: all keys deleted');
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache flush error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
