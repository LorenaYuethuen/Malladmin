/**
 * Zod validation schemas for Order API
 */

import { z } from 'zod';
import { OrderStatus, PaymentStatus, AddressType } from '../types/order';

// Address schema (reusable)
const addressSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required').max(255),
  phone: z.string().min(1, 'Phone is required').max(50),
  email: z.string().email('Invalid email').optional(),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1, 'City is required').max(255),
  state: z.string().min(1, 'State is required').max(255),
  postalCode: z.string().min(1, 'Postal code is required').max(50),
  country: z.string().min(1, 'Country is required').max(255),
});

// Order item schema
const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative').optional(),
});

// Create order schema
export const createOrderSchema = {
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
    items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional(),
    paymentMethod: z.string().min(1, 'Payment method is required').max(100),
    shippingMethod: z.string().min(1, 'Shipping method is required').max(100),
    customerNotes: z.string().max(2000).optional(),
    couponCode: z.string().max(100).optional(),
  }),
};

// Update order status schema
export const updateOrderStatusSchema = {
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus, {
      errorMap: () => ({ message: 'Invalid order status' }),
    }),
    adminNotes: z.string().max(2000).optional(),
    trackingNumber: z.string().max(255).optional(),
  }),
};

// Cancel order schema
export const cancelOrderSchema = {
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required').max(2000),
    adminNotes: z.string().max(2000).optional(),
  }),
};

// Get order schema
export const getOrderSchema = {
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
};

// Delete order schema
export const deleteOrderSchema = {
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
};

// List orders schema
export const listOrdersSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    
    // Filters
    status: z.union([
      z.nativeEnum(OrderStatus),
      z.string().transform((val) => val.split(',') as OrderStatus[]),
    ]).optional(),
    paymentStatus: z.union([
      z.nativeEnum(PaymentStatus),
      z.string().transform((val) => val.split(',') as PaymentStatus[]),
    ]).optional(),
    userId: z.string().uuid().optional(),
    orderNumber: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    minTotal: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    maxTotal: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    paymentMethod: z.string().optional(),
    shippingMethod: z.string().optional(),
    search: z.string().optional(),
  }),
};

// Export orders CSV schema
export const exportOrdersCSVSchema = {
  query: z.object({
    status: z.union([
      z.nativeEnum(OrderStatus),
      z.string().transform((val) => val.split(',') as OrderStatus[]),
    ]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    userId: z.string().uuid().optional(),
  }),
};

// Get order analytics schema
export const getOrderAnalyticsSchema = {
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    groupBy: z.enum(['day', 'week', 'month']).optional(),
  }),
};
