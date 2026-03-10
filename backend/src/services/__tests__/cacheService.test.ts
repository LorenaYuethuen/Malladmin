import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the redis module before importing cacheService
vi.mock('../../database/redis', () => {
  const mockClient = {
    get: vi.fn(),
    setEx: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    expire: vi.fn(),
    mGet: vi.fn(),
    multi: vi.fn(),
    flushDb: vi.fn(),
  };
  
  return {
    default: {
      getClient: () => mockClient,
    },
  };
});

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Now import after mocks are set up
import cacheService, { CacheTTL, CachePrefix } from '../cacheService';
import redis from '../../database/redis';

describe('CacheService', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = redis.getClient();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up multi to return a pipeline object
    mockClient.multi.mockReturnValue({
      setEx: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });
    
    // Reset stats
    cacheService.resetStats();
  });

  describe('get', () => {
    it('should return parsed value on cache hit', async () => {
      const testData = { id: '123', name: 'Test Product' };
      mockClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('product:123');

      expect(result).toEqual(testData);
      expect(mockClient.get).toHaveBeenCalledWith('product:123');
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should return null on cache miss', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cacheService.get('product:999');

      expect(result).toBeNull();
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('product:123');

      expect(result).toBeNull();
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const testData = { id: '123', name: 'Test Product' };
      mockClient.setEx.mockResolvedValue('OK');

      const result = await cacheService.set('product:123', testData);

      expect(result).toBe(true);
      expect(mockClient.setEx).toHaveBeenCalledWith(
        'product:123',
        CacheTTL.DEFAULT,
        JSON.stringify(testData)
      );
      
      const stats = cacheService.getStats();
      expect(stats.sets).toBe(1);
    });

    it('should set value with custom TTL', async () => {
      const testData = { id: '123', name: 'Test Product' };
      mockClient.setEx.mockResolvedValue('OK');

      const result = await cacheService.set('product:123', testData, CacheTTL.PRODUCT_DETAIL);

      expect(result).toBe(true);
      expect(mockClient.setEx).toHaveBeenCalledWith(
        'product:123',
        CacheTTL.PRODUCT_DETAIL,
        JSON.stringify(testData)
      );
    });

    it('should handle errors gracefully', async () => {
      mockClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('product:123', { id: '123' });

      expect(result).toBe(false);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete key successfully', async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await cacheService.delete('product:123');

      expect(result).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('product:123');
      
      const stats = cacheService.getStats();
      expect(stats.deletes).toBe(1);
    });

    it('should return false if key does not exist', async () => {
      mockClient.del.mockResolvedValue(0);

      const result = await cacheService.delete('product:999');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.delete('product:123');

      expect(result).toBe(false);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('deletePattern', () => {
    it('should delete all keys matching pattern', async () => {
      mockClient.keys.mockResolvedValue(['product:1', 'product:2', 'product:3']);
      mockClient.del.mockResolvedValue(3);

      const result = await cacheService.deletePattern('product:*');

      expect(result).toBe(3);
      expect(mockClient.keys).toHaveBeenCalledWith('product:*');
      expect(mockClient.del).toHaveBeenCalledWith(['product:1', 'product:2', 'product:3']);
      
      const stats = cacheService.getStats();
      expect(stats.deletes).toBe(3);
    });

    it('should return 0 if no keys match pattern', async () => {
      mockClient.keys.mockResolvedValue([]);

      const result = await cacheService.deletePattern('product:*');

      expect(result).toBe(0);
      expect(mockClient.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.deletePattern('product:*');

      expect(result).toBe(0);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await cacheService.exists('product:123');

      expect(result).toBe(true);
      expect(mockClient.exists).toHaveBeenCalledWith('product:123');
    });

    it('should return false if key does not exist', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await cacheService.exists('product:999');

      expect(result).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should return TTL for key', async () => {
      mockClient.ttl.mockResolvedValue(3600);

      const result = await cacheService.getTTL('product:123');

      expect(result).toBe(3600);
      expect(mockClient.ttl).toHaveBeenCalledWith('product:123');
    });

    it('should return -1 on error', async () => {
      mockClient.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getTTL('product:123');

      expect(result).toBe(-1);
    });
  });

  describe('setTTL', () => {
    it('should set TTL for key', async () => {
      mockClient.expire.mockResolvedValue(true);

      const result = await cacheService.setTTL('product:123', 7200);

      expect(result).toBe(true);
      expect(mockClient.expire).toHaveBeenCalledWith('product:123', 7200);
    });

    it('should handle errors gracefully', async () => {
      mockClient.expire.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.setTTL('product:123', 7200);

      expect(result).toBe(false);
    });
  });

  describe('mget', () => {
    it('should get multiple values at once', async () => {
      const data1 = { id: '1', name: 'Product 1' };
      const data2 = { id: '2', name: 'Product 2' };
      mockClient.mGet.mockResolvedValue([
        JSON.stringify(data1),
        JSON.stringify(data2),
        null,
      ]);

      const result = await cacheService.mget(['product:1', 'product:2', 'product:3']);

      expect(result).toEqual([data1, data2, null]);
      expect(mockClient.mGet).toHaveBeenCalledWith(['product:1', 'product:2', 'product:3']);
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should return empty array for empty input', async () => {
      const result = await cacheService.mget([]);

      expect(result).toEqual([]);
      expect(mockClient.mGet).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockClient.mGet.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.mget(['product:1', 'product:2']);

      expect(result).toEqual([null, null]);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('mset', () => {
    it('should set multiple values at once', async () => {
      const pipeline = {
        setEx: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockClient.multi.mockReturnValue(pipeline);

      const entries = [
        { key: 'product:1', value: { id: '1' }, ttl: 3600 },
        { key: 'product:2', value: { id: '2' }, ttl: 7200 },
      ];

      const result = await cacheService.mset(entries);

      expect(result).toBe(true);
      expect(pipeline.setEx).toHaveBeenCalledTimes(2);
      expect(pipeline.exec).toHaveBeenCalled();
      
      const stats = cacheService.getStats();
      expect(stats.sets).toBe(2);
    });

    it('should use default TTL if not specified', async () => {
      const pipeline = {
        setEx: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockClient.multi.mockReturnValue(pipeline);

      const entries = [{ key: 'product:1', value: { id: '1' } }];

      await cacheService.mset(entries);

      expect(pipeline.setEx).toHaveBeenCalledWith(
        'product:1',
        CacheTTL.DEFAULT,
        JSON.stringify({ id: '1' })
      );
    });

    it('should handle errors gracefully', async () => {
      mockClient.multi.mockImplementation(() => {
        throw new Error('Redis error');
      });

      const result = await cacheService.mset([{ key: 'product:1', value: { id: '1' } }]);

      expect(result).toBe(false);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const testData = { id: '123', name: 'Test Product' };
      mockClient.get.mockResolvedValue(JSON.stringify(testData));

      const fetchFn = vi.fn();
      const result = await cacheService.getOrSet('product:123', fetchFn);

      expect(result).toEqual(testData);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not in cache', async () => {
      const testData = { id: '123', name: 'Test Product' };
      mockClient.get.mockResolvedValue(null);
      mockClient.setEx.mockResolvedValue('OK');

      const fetchFn = vi.fn().mockResolvedValue(testData);
      const result = await cacheService.getOrSet('product:123', fetchFn, CacheTTL.PRODUCT_DETAIL);

      expect(result).toEqual(testData);
      expect(fetchFn).toHaveBeenCalled();
      expect(mockClient.setEx).toHaveBeenCalledWith(
        'product:123',
        CacheTTL.PRODUCT_DETAIL,
        JSON.stringify(testData)
      );
    });
  });

  describe('invalidate', () => {
    it('should invalidate multiple patterns', async () => {
      mockClient.keys
        .mockResolvedValueOnce(['product:1', 'product:2'])
        .mockResolvedValueOnce(['product:list:1', 'product:list:2']);
      mockClient.del.mockResolvedValue(2);

      const result = await cacheService.invalidate(['product:*', 'product:list:*']);

      expect(result).toBe(4);
      expect(mockClient.keys).toHaveBeenCalledTimes(2);
      expect(mockClient.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('product cache helpers', () => {
    it('should generate correct product detail key', () => {
      const key = cacheService.product.getDetail('123');
      expect(key).toBe('product:123');
    });

    it('should generate correct product list key', () => {
      const key = cacheService.product.getList(1, 20, 'status:active');
      expect(key).toBe('product:list:page:1:limit:20:status:active');
    });

    it('should invalidate all product cache', async () => {
      mockClient.keys.mockResolvedValue(['product:1', 'product:2']);
      mockClient.del.mockResolvedValue(2);

      await cacheService.product.invalidateAll();

      expect(mockClient.keys).toHaveBeenCalledWith('product:*');
    });

    it('should invalidate product detail', async () => {
      mockClient.del.mockResolvedValue(1);

      await cacheService.product.invalidateDetail('123');

      expect(mockClient.del).toHaveBeenCalledWith('product:123');
    });

    it('should invalidate product lists', async () => {
      mockClient.keys.mockResolvedValue(['product:list:1', 'product:list:2']);
      mockClient.del.mockResolvedValue(2);

      await cacheService.product.invalidateLists();

      expect(mockClient.keys).toHaveBeenCalledWith('product:list:*');
    });
  });

  describe('order cache helpers', () => {
    it('should generate correct order detail key', () => {
      const key = cacheService.order.getDetail('order123');
      expect(key).toBe('order:order123');
    });

    it('should generate correct order list key', () => {
      const key = cacheService.order.getList('user123', 1, 20);
      expect(key).toBe('order:list:user123:page:1:limit:20');
    });

    it('should generate correct analytics key', () => {
      const key = cacheService.order.getAnalytics('2024-01');
      expect(key).toBe('analytics:orders:2024-01');
    });

    it('should invalidate user orders', async () => {
      mockClient.keys.mockResolvedValue(['order:list:user123:page:1']);
      mockClient.del.mockResolvedValue(1);

      await cacheService.order.invalidateUserOrders('user123');

      expect(mockClient.keys).toHaveBeenCalledWith('order:list:user123:*');
    });
  });

  describe('statistics', () => {
    it('should track cache statistics correctly', async () => {
      mockClient.get
        .mockResolvedValueOnce(JSON.stringify({ id: '1' })) // hit
        .mockResolvedValueOnce(null) // miss
        .mockResolvedValueOnce(JSON.stringify({ id: '2' })); // hit
      mockClient.setEx.mockResolvedValue('OK');
      mockClient.del.mockResolvedValue(1);

      await cacheService.get('key1');
      await cacheService.get('key2');
      await cacheService.get('key3');
      await cacheService.set('key4', { id: '4' });
      await cacheService.delete('key5');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should reset statistics', async () => {
      mockClient.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      
      await cacheService.get('key1');
      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('flushAll', () => {
    it('should flush all cache', async () => {
      mockClient.flushDb.mockResolvedValue('OK');

      const result = await cacheService.flushAll();

      expect(result).toBe(true);
      expect(mockClient.flushDb).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockClient.flushDb.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.flushAll();

      expect(result).toBe(false);
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });
});
