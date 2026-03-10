/**
 * Rate Limiting Middleware
 * Redis-based rate limiting with configurable limits per endpoint
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../database/redis';
import { RateLimitError } from '../utils/errors';
import config from '../config';

/**
 * Create rate limiter with Redis store
 * This function is called lazily to ensure Redis is connected
 */
export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: any) => string;
}) {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    keyGenerator,
  } = options;

  return rateLimit({
    store: new RedisStore({
      // @ts-ignore - rate-limit-redis types may not match exactly
      sendCommand: (...args: string[]) => redis.getClient().sendCommand(args),
      prefix: 'rate_limit:',
    }),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise IP address
      const user = (req as any).user;
      return user ? `user:${user.id}` : `ip:${req.ip}`;
    }),
    handler: (_req, res) => {
      const error = new RateLimitError(Math.ceil(windowMs / 1000));
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId,
          version: config.apiVersion,
        },
      });
    },
  });
}

// Export factory functions instead of instances
// These will be called when routes are set up (after Redis is connected)

/**
 * Product API rate limiter - 100 requests per 15 minutes per user
 */
export const getProductRateLimiter = () => createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

/**
 * Strict rate limiter for write operations - 50 requests per 15 minutes
 */
export const getStrictRateLimiter = () => createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

/**
 * Image upload rate limiter - 20 uploads per 15 minutes
 */
export const getUploadRateLimiter = () => createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

/**
 * Bulk operation rate limiter - 10 requests per 15 minutes
 */
export const getBulkOperationRateLimiter = () => createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

/**
 * Export rate limiter - 10 exports per 15 minutes
 */
export const getExportRateLimiter = () => createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Pre-initialized rate limiters (will be set after Redis connects)
let _productRateLimiter: any;
let _strictRateLimiter: any;
let _uploadRateLimiter: any;
let _bulkOperationRateLimiter: any;
let _exportRateLimiter: any;

/**
 * Initialize all rate limiters - must be called after Redis is connected
 */
export function initializeRateLimiters() {
  _productRateLimiter = getProductRateLimiter();
  _strictRateLimiter = getStrictRateLimiter();
  _uploadRateLimiter = getUploadRateLimiter();
  _bulkOperationRateLimiter = getBulkOperationRateLimiter();
  _exportRateLimiter = getExportRateLimiter();
}

export const productRateLimiter = (req: any, res: any, next: any) => {
  if (!_productRateLimiter) {
    // Skip rate limiting if not initialized yet
    return next();
  }
  return _productRateLimiter(req, res, next);
};

export const strictRateLimiter = (req: any, res: any, next: any) => {
  if (!_strictRateLimiter) {
    return next();
  }
  return _strictRateLimiter(req, res, next);
};

export const uploadRateLimiter = (req: any, res: any, next: any) => {
  if (!_uploadRateLimiter) {
    return next();
  }
  return _uploadRateLimiter(req, res, next);
};

export const bulkOperationRateLimiter = (req: any, res: any, next: any) => {
  if (!_bulkOperationRateLimiter) {
    return next();
  }
  return _bulkOperationRateLimiter(req, res, next);
};

export const exportRateLimiter = (req: any, res: any, next: any) => {
  if (!_exportRateLimiter) {
    return next();
  }
  return _exportRateLimiter(req, res, next);
};
