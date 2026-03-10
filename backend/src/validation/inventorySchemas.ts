/**
 * Inventory Validation Schemas
 * 
 * Zod schemas for validating inventory operations.
 * Covers reserve, deduct, release, update, check, and alert queries.
 */

import { z } from 'zod';

/**
 * Schema for a single inventory item in bulk operations
 */
const inventoryItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
});

/**
 * Schema for reserving inventory.
 * orderId is required to track which order the reservation belongs to.
 * items must contain at least one product with a positive quantity.
 */
export const reserveInventorySchema = z.object({
  body: z.object({
    items: z
      .array(inventoryItemSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Cannot reserve more than 100 items at once'),
    orderId: z.string().uuid('Invalid order ID format').optional(),
  }),
});

/**
 * Schema for deducting (confirming) inventory.
 * Used when an order is paid — converts reserved stock to deducted.
 */
export const deductInventorySchema = z.object({
  body: z.object({
    items: z
      .array(inventoryItemSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Cannot deduct more than 100 items at once'),
    orderId: z.string().uuid('Invalid order ID format').optional(),
  }),
});

/**
 * Schema for releasing reserved inventory.
 * Used when an order is cancelled or a reservation expires.
 */
export const releaseInventorySchema = z.object({
  body: z.object({
    items: z
      .array(inventoryItemSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Cannot release more than 100 items at once'),
    orderId: z.string().uuid('Invalid order ID format').optional(),
  }),
});

/**
 * Schema for updating inventory (restock)
 */
export const updateInventorySchema = z.object({
  params: z.object({
    productId: z.string().uuid('Invalid product ID format'),
  }),
  body: z.object({
    quantity: z.number().int('Quantity must be an integer').min(0, 'Quantity cannot be negative'),
    lowStockThreshold: z
      .number()
      .int('Low stock threshold must be an integer')
      .min(0, 'Low stock threshold cannot be negative')
      .optional(),
  }),
});

/**
 * Schema for getting inventory by product ID
 */
export const getInventorySchema = z.object({
  params: z.object({
    productId: z.string().uuid('Invalid product ID format'),
  }),
});

/**
 * Schema for checking inventory availability
 */
export const checkInventorySchema = z.object({
  body: z.object({
    items: z
      .array(inventoryItemSchema)
      .min(1, 'At least one item is required')
      .max(100, 'Cannot check more than 100 items at once'),
  }),
});

/**
 * Schema for getting low stock alerts
 */
export const getLowStockAlertsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .pipe(z.number().int().min(1).max(200))
      .optional(),
  }),
});

export type ReserveInventoryInput = z.infer<typeof reserveInventorySchema>;
export type DeductInventoryInput = z.infer<typeof deductInventorySchema>;
export type ReleaseInventoryInput = z.infer<typeof releaseInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type GetInventoryInput = z.infer<typeof getInventorySchema>;
export type CheckInventoryInput = z.infer<typeof checkInventorySchema>;
export type GetLowStockAlertsInput = z.infer<typeof getLowStockAlertsSchema>;
