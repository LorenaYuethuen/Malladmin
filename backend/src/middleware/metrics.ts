/**
 * Metrics Middleware
 * Automatically collects HTTP request metrics
 */

import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal, httpRequestErrors } from '../services/metricsService';

/**
 * Middleware to collect HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = getRoutePattern(req);
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record request duration
    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      duration
    );

    // Increment request counter
    httpRequestTotal.inc({
      method,
      route,
      status_code: statusCode,
    });

    // Track errors (4xx and 5xx status codes)
    if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
      const errorType = statusCode.startsWith('4') ? 'client_error' : 'server_error';
      httpRequestErrors.inc({
        method,
        route,
        error_type: errorType,
      });
    }
  });

  next();
}

/**
 * Extract route pattern from request
 * This normalizes routes like /api/v1/products/123 to /api/v1/products/:id
 */
function getRoutePattern(req: Request): string {
  // If route is available from Express router
  if (req.route && req.route.path) {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${req.route.path}`;
  }

  // Fallback to path with normalized IDs
  let path = req.path;

  // Replace UUIDs with :id
  path = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id'
  );

  // Replace numeric IDs with :id
  path = path.replace(/\/\d+/g, '/:id');

  return path;
}
