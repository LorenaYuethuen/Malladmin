import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../utils/logger';

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: res.locals.requestId,
  });

  // Send error response
  if (err instanceof ApiError) {
    sendError(res, err);
  } else {
    // Unexpected error
    sendError(res, new ApiError('INTERNAL_ERROR' as any, err.message), 500);
  }
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new ApiError(
    'NOT_FOUND' as any,
    `Route ${req.method} ${req.path} not found`
  );
  sendError(res, error, 404);
}
