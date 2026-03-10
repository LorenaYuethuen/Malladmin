import { Response } from 'express';
import { ApiResponse } from '../types';
import { ApiError } from './errors';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || uuidv4(),
      version: config.apiVersion,
    },
  };
}

export function createErrorResponse(
  error: ApiError | Error,
  requestId?: string
): ApiResponse<null> {
  const isApiError = error instanceof ApiError;

  return {
    success: false,
    data: null,
    error: {
      code: isApiError ? error.code : 'INTERNAL_ERROR',
      message: error.message,
      details: isApiError ? error.details : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || uuidv4(),
      version: config.apiVersion,
    },
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const requestId = (res.locals.requestId as string) || uuidv4();
  return res.status(statusCode).json(createSuccessResponse(data, message, requestId));
}

export function sendError(
  res: Response,
  error: ApiError | Error,
  statusCode?: number
): Response {
  const requestId = (res.locals.requestId as string) || uuidv4();
  const status = statusCode || (error instanceof ApiError ? error.statusCode : 500);
  return res.status(status).json(createErrorResponse(error, requestId));
}

// Alias for backward compatibility
export const successResponse = createSuccessResponse;
