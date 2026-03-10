import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ForbiddenError } from '../utils/errors';

/**
 * CSRF Token Configuration
 * Uses environment variables for configuration
 */
const CSRF_TOKEN_LENGTH = parseInt(process.env.CSRF_TOKEN_LENGTH || '32', 10);
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';
const CSRF_HEADER_NAME = process.env.CSRF_HEADER_NAME || 'x-csrf-token';
const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and set CSRF token in cookie
 * This should be applied to routes that render forms or need CSRF protection
 */
export const setCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Check if token already exists in cookie
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    // Generate new token if not exists or if rotation is needed
    if (!token || shouldRotateToken(req)) {
      token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    }

    // Make token available to the response for client-side access
    // This allows the frontend to read the token and include it in requests
    res.locals.csrfToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate CSRF token using double-submit cookie pattern
 * This should be applied to state-changing operations (POST, PUT, PATCH, DELETE)
 */
export const validateCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Skip CSRF validation for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip CSRF validation in development mode
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    // Get token from header
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;

    // Validate tokens exist
    if (!cookieToken) {
      throw new ForbiddenError('CSRF token missing in cookie');
    }

    if (!headerToken) {
      throw new ForbiddenError('CSRF token missing in request header');
    }

    // Validate tokens match (double-submit cookie pattern)
    if (!timingSafeEqual(cookieToken, headerToken)) {
      throw new ForbiddenError('CSRF token mismatch');
    }

    // Token is valid, proceed
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Combined middleware that sets and validates CSRF token
 * Use this for routes that need both token generation and validation
 */
export const csrfProtection = [setCsrfToken, validateCsrfToken];

/**
 * Middleware to expose CSRF token to client
 * This creates an endpoint that returns the CSRF token for client-side use
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const token = res.locals.csrfToken || req.cookies?.[CSRF_COOKIE_NAME];

  if (!token) {
    const newToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, CSRF_COOKIE_OPTIONS);
    res.json({
      success: true,
      data: {
        csrfToken: newToken,
      },
    });
  } else {
    res.json({
      success: true,
      data: {
        csrfToken: token,
      },
    });
  }
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Determine if CSRF token should be rotated
 * Token rotation helps prevent token fixation attacks
 */
function shouldRotateToken(req: Request): boolean {
  // Rotate token after authentication state changes
  if (req.path.includes('/auth/login') || req.path.includes('/auth/logout')) {
    return true;
  }

  // Rotate token periodically (e.g., every hour)
  // This can be implemented by storing token creation time in a signed cookie
  // For now, we'll keep it simple and rotate on auth changes only

  return false;
}

/**
 * Middleware to skip CSRF validation for specific routes
 * Useful for API endpoints that use other authentication methods
 */
export const skipCsrfValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Mark request as CSRF-exempt
  (req as any).csrfExempt = true;
  next();
};

/**
 * Conditional CSRF validation middleware
 * Only validates if request is not marked as exempt
 */
export const conditionalCsrfValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if ((req as any).csrfExempt) {
    return next();
  }
  validateCsrfToken(req, res, next);
};
