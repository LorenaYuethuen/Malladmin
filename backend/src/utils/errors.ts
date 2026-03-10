import { ErrorCode } from '../types';

export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.INSUFFICIENT_STOCK]: 400,
  [ErrorCode.PAYMENT_FAILED]: 400,
  [ErrorCode.ORDER_CANCELLED]: 400,
  [ErrorCode.INVALID_COUPON]: 400,
  [ErrorCode.PRODUCT_UNAVAILABLE]: 400,
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(code: ErrorCode, message?: string, details?: any) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = ErrorCodeToHttpStatus[code];
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class ValidationError extends ApiError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message || 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message || 'Bad request', details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message?: string) {
    super(ErrorCode.UNAUTHORIZED, message || 'Authentication required');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message?: string) {
    super(ErrorCode.FORBIDDEN, message || 'Insufficient permissions');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.CONFLICT, message || 'Resource conflict', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests, please try again later',
      { retryAfter }
    );
    this.name = 'RateLimitError';
  }
}

export class InternalError extends ApiError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.INTERNAL_ERROR, message || 'Internal server error', details);
    this.name = 'InternalError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message?: string) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      message || 'Service temporarily unavailable'
    );
    this.name = 'ServiceUnavailableError';
  }
}
