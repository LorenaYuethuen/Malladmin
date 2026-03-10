import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cacheService, CacheTTL, CachePrefix } from '../services/cacheService';
import { BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { AuthRequest } from '../types';

/**
 * Idempotency key configuration
 */
export interface IdempotencyConfig {
  /**
   * TTL for idempotency records in seconds
   * Default: 24 hours (86400 seconds)
   */
  ttl?: number;

  /**
   * HTTP methods to apply idempotency to
   * Default: ['POST', 'PUT', 'PATCH']
   */
  methods?: string[];

  /**
   * Header name for idempotency key
   * Default: 'X-Idempotency-Key'
   */
  headerName?: string;

  /**
   * Whether to require idempotency key
   * Default: false (optional)
   */
  required?: boolean;
}

/**
 * Stored idempotency record
 */
interface IdempotencyRecord {
  /**
   * Request fingerprint for validation
   */
  fingerprint: string;

  /**
   * HTTP status code of the original response
   */
  statusCode: number;

  /**
   * Response body of the original request
   */
  body: any;

  /**
   * Response headers of the original request
   */
  headers: Record<string, string>;

  /**
   * Timestamp when the record was created
   */
  createdAt: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<IdempotencyConfig> = {
  ttl: CacheTTL.IDEMPOTENCY_KEY,
  methods: ['POST', 'PUT', 'PATCH'],
  headerName: 'X-Idempotency-Key',
  required: false,
};

/**
 * Generate request fingerprint for validation
 * Ensures the same idempotency key is not reused with different request data
 */
function generateFingerprint(req: Request): string {
  const data = {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    // Include user ID if authenticated to prevent cross-user replay
    userId: (req as AuthRequest).user?.id,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Build cache key for idempotency record
 */
function buildIdempotencyKey(idempotencyKey: string): string {
  return `${CachePrefix.IDEMPOTENCY}:${idempotencyKey}`;
}

/**
 * Validate idempotency key format
 * Should be a UUID or similar unique identifier
 */
function validateIdempotencyKey(key: string): boolean {
  // Allow UUID v4, alphanumeric with hyphens, min 16 chars, max 128 chars
  const pattern = /^[a-zA-Z0-9_-]{16,128}$/;
  return pattern.test(key);
}

/**
 * Idempotency middleware
 * 
 * Prevents duplicate processing of requests by caching responses based on idempotency keys.
 * 
 * Usage:
 * ```typescript
 * // Apply to specific routes
 * router.post('/orders', idempotency(), createOrder);
 * 
 * // With custom configuration
 * router.post('/payments', idempotency({ required: true, ttl: 3600 }), processPayment);
 * 
 * // Apply globally to all state-changing methods
 * app.use(idempotency());
 * ```
 * 
 * Client usage:
 * ```
 * POST /api/v1/orders
 * X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
 * Content-Type: application/json
 * 
 * { "productId": "123", "quantity": 2 }
 * ```
 */
export function idempotency(config: IdempotencyConfig = {}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only apply to configured HTTP methods
      if (!finalConfig.methods.includes(req.method)) {
        return next();
      }

      // Extract idempotency key from header
      const idempotencyKey = req.headers[finalConfig.headerName.toLowerCase()] as string;

      // Check if idempotency key is required
      if (!idempotencyKey) {
        if (finalConfig.required) {
          throw new BadRequestError(
            `${finalConfig.headerName} header is required for ${req.method} requests`
          );
        }
        // If not required, skip idempotency check
        return next();
      }

      // Validate idempotency key format
      if (!validateIdempotencyKey(idempotencyKey)) {
        throw new BadRequestError(
          `Invalid ${finalConfig.headerName} format. Must be 16-128 alphanumeric characters with hyphens/underscores`
        );
      }

      // Generate request fingerprint
      const fingerprint = generateFingerprint(req);
      const cacheKey = buildIdempotencyKey(idempotencyKey);

      // Check if request was already processed
      const existingRecord = await cacheService.get<IdempotencyRecord>(cacheKey);

      if (existingRecord) {
        // Validate that the request is identical
        if (existingRecord.fingerprint !== fingerprint) {
          logger.warn('Idempotency key reused with different request', {
            idempotencyKey,
            existingFingerprint: existingRecord.fingerprint,
            newFingerprint: fingerprint,
            path: req.path,
            method: req.method,
          });

          throw new BadRequestError(
            'Idempotency key has been used with a different request. Please use a new key.'
          );
        }

        // Return cached response
        logger.info('Returning cached response for idempotent request', {
          idempotencyKey,
          path: req.path,
          method: req.method,
          statusCode: existingRecord.statusCode,
        });

        // Set cached headers
        Object.entries(existingRecord.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add header to indicate this is a cached response
        res.setHeader('X-Idempotency-Replayed', 'true');

        res.status(existingRecord.statusCode).json(existingRecord.body);
        return;
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      let statusCode = 200;

      // Override res.status to capture status code
      res.status = function (code: number) {
        statusCode = code;
        return originalStatus(code);
      };

      // Override res.json to cache the response
      res.json = function (body: any) {
        // Only cache successful responses (2xx status codes)
        if (statusCode >= 200 && statusCode < 300) {
          const record: IdempotencyRecord = {
            fingerprint,
            statusCode,
            body,
            headers: {
              'content-type': res.getHeader('content-type') as string || 'application/json',
              'x-request-id': res.getHeader('x-request-id') as string || '',
            },
            createdAt: new Date().toISOString(),
          };

          // Store in cache asynchronously (don't wait)
          cacheService.set(cacheKey, record, finalConfig.ttl).catch((error) => {
            logger.error('Failed to store idempotency record', {
              error: error.message,
              idempotencyKey,
              path: req.path,
            });
          });

          logger.info('Stored idempotency record', {
            idempotencyKey,
            path: req.path,
            method: req.method,
            statusCode,
            ttl: finalConfig.ttl,
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Manually invalidate an idempotency key
 * Useful for testing or manual cleanup
 */
export async function invalidateIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  const cacheKey = buildIdempotencyKey(idempotencyKey);
  return await cacheService.delete(cacheKey);
}

/**
 * Get idempotency record for debugging
 */
export async function getIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
  const cacheKey = buildIdempotencyKey(idempotencyKey);
  return await cacheService.get<IdempotencyRecord>(cacheKey);
}

/**
 * Check if an idempotency key exists
 */
export async function hasIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  const cacheKey = buildIdempotencyKey(idempotencyKey);
  return await cacheService.exists(cacheKey);
}
