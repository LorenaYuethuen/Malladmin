/**
 * Return Request Validation Schemas
 * 
 * Zod schemas for validating return request data.
 */

import { z } from 'zod';
import { ReturnStatus, RefundStatus, ReturnItemStatus } from '../types/return';

/**
 * Schema for creating a return request
 * Validates: reason non-empty, amount > 0, valid UUIDs
 */
export const createReturnRequestSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Invalid order ID format'),
    userId: z.string().uuid('Invalid user ID format'),
    items: z.array(
      z.object({
        orderItemId: z.string().uuid('Invalid order item ID format'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
        reason: z.string()
          .min(1, 'Item return reason is required')
          .max(100, 'Item return reason must be at most 100 characters'),
        condition: z.string().max(50, 'Condition must be at most 50 characters').optional(),
      })
    ).min(1, 'At least one item is required'),
    reason: z.string()
      .min(1, 'Return reason is required')
      .max(100, 'Return reason must be at most 100 characters'),
    description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
    amount: z.number().positive('Refund amount must be greater than 0').optional(),
    refundMethod: z.string().max(50, 'Refund method must be at most 50 characters').optional(),
  }),
});

/**
 * Schema for updating return request status
 * PUT /returns/:id/status
 * Supports the full status flow: pending → approved → refunding → completed / rejected
 */
export const updateReturnStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid return request ID'),
  }),
  body: z.object({
    status: z.enum(
      [
        ReturnStatus.APPROVED,
        ReturnStatus.REJECTED,
        ReturnStatus.REFUNDING,
        ReturnStatus.COMPLETED,
        ReturnStatus.CANCELLED,
      ],
      {
        errorMap: () => ({
          message: 'Status must be one of: approved, rejected, refunding, completed, cancelled',
        }),
      }
    ),
    adminNotes: z.string().max(1000, 'Admin notes must be at most 1000 characters').optional(),
    refundAmount: z.number().positive('Refund amount must be greater than 0').optional(),
  }),
});

/**
 * Schema for processing return request (approve/reject/complete)
 * Legacy endpoint: PUT /returns/:id/process
 */
export const processReturnRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid return request ID'),
  }),
  body: z.object({
    action: z.enum(['approve', 'reject', 'complete'], {
      errorMap: () => ({ message: 'Action must be approve, reject, or complete' }),
    }),
    adminNotes: z.string().max(1000, 'Admin notes must be at most 1000 characters').optional(),
  }),
});

/**
 * Schema for getting return request by ID
 */
export const getReturnRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid return request ID'),
  }),
});

/**
 * Schema for listing return requests with filters
 */
export const listReturnRequestsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.enum(['requestedAt', 'refundAmount', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(), // Can be single or comma-separated
    userId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    returnNumber: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

/**
 * Schema for cancelling a return request
 */
export const cancelReturnRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid return request ID'),
  }),
});

export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>;
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>;
export type ProcessReturnRequestInput = z.infer<typeof processReturnRequestSchema>;
export type GetReturnRequestInput = z.infer<typeof getReturnRequestSchema>;
export type ListReturnRequestsInput = z.infer<typeof listReturnRequestsSchema>;
export type CancelReturnRequestInput = z.infer<typeof cancelReturnRequestSchema>;
