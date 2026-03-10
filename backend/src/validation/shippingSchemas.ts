/**
 * Shipping Validation Schemas
 * 
 * Zod schemas for validating shipping and tracking data.
 */

import { z } from 'zod';
import { TrackingStatus, LogisticsProvider } from '../types/shipping';

/**
 * Schema for assigning tracking number to order
 */
export const assignTrackingSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  trackingNumber: z
    .string()
    .min(5, 'Tracking number must be at least 5 characters')
    .max(100, 'Tracking number must not exceed 100 characters')
    .trim(),
  carrier: z
    .string()
    .min(2, 'Carrier name must be at least 2 characters')
    .max(100, 'Carrier name must not exceed 100 characters')
    .trim(),
  shippingMethod: z
    .string()
    .max(100, 'Shipping method must not exceed 100 characters')
    .trim()
    .optional(),
  estimatedDeliveryDate: z
    .string()
    .datetime('Invalid date format')
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'))
    .optional(),
});

/**
 * Schema for updating tracking status
 */
export const updateTrackingStatusSchema = z.object({
  status: z.nativeEnum(TrackingStatus, {
    errorMap: () => ({ message: 'Invalid tracking status' }),
  }),
  location: z
    .string()
    .max(255, 'Location must not exceed 255 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .optional(),
  occurredAt: z
    .string()
    .datetime('Invalid datetime format')
    .optional(),
});

/**
 * Schema for refreshing tracking from logistics provider
 */
export const refreshTrackingSchema = z.object({
  trackingNumber: z
    .string()
    .min(5, 'Tracking number must be at least 5 characters')
    .max(100, 'Tracking number must not exceed 100 characters')
    .trim(),
  carrier: z
    .string()
    .min(2, 'Carrier name must be at least 2 characters')
    .max(100, 'Carrier name must not exceed 100 characters')
    .trim(),
});

/**
 * Schema for tracking query parameters
 */
export const trackingQuerySchema = z.object({
  orderId: z.string().uuid('Invalid order ID format').optional(),
  trackingNumber: z.string().trim().optional(),
  carrier: z.string().trim().optional(),
  status: z.nativeEnum(TrackingStatus).optional(),
});

/**
 * Schema for tracking ID parameter
 */
export const trackingIdSchema = z.object({
  id: z.string().uuid('Invalid tracking ID format'),
});

/**
 * Schema for order ID parameter
 */
export const orderIdSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

/**
 * Type exports for TypeScript inference
 */
export type AssignTrackingInput = z.infer<typeof assignTrackingSchema>;
export type UpdateTrackingStatusInput = z.infer<typeof updateTrackingStatusSchema>;
export type RefreshTrackingInput = z.infer<typeof refreshTrackingSchema>;
export type TrackingQueryInput = z.infer<typeof trackingQuerySchema>;
