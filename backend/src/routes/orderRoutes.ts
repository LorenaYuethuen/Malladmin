/**
 * Order Routes
 * API versioning: /api/v1/orders
 * 
 * Features:
 * - CRUD operations with validation
 * - Order status management with state machine
 * - Order cancellation with inventory rollback
 * - CSV export functionality
 * - Order analytics
 * - Rate limiting (100 req/15min for reads, 50 req/15min for writes)
 * - RBAC permission middleware (admin, merchant, customer roles)
 * - Idempotency key handling for create operations
 * - Request/response logging with correlation IDs
 * - Caching for order analytics
 * - OpenAPI documentation annotations
 * - Outbox event publishing for order state changes
 */

import { Router } from 'express';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  exportOrdersCSV,
  getOrderAnalytics,
} from '../controllers/orderController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { idempotency } from '../middleware/idempotency';
import {
  productRateLimiter,
  strictRateLimiter,
  exportRateLimiter,
} from '../middleware/rateLimiter';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  getOrderSchema,
  listOrdersSchema,
  exportOrdersCSVSchema,
  getOrderAnalyticsSchema,
} from '../validation/orderSchemas';

const router = Router();

/**
 * @route   GET /api/v1/orders
 * @desc    List orders with filtering, sorting, and pagination
 * @access  Private (admin, merchant, customer - filtered by role)
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: string (default: 'created_at')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 * - status: OrderStatus | OrderStatus[] (filter by status)
 * - paymentStatus: PaymentStatus | PaymentStatus[] (filter by payment status)
 * - userId: UUID (filter by user)
 * - orderNumber: string (filter by order number)
 * - startDate: ISO datetime (filter by start date)
 * - endDate: ISO datetime (filter by end date)
 * - minTotal: number (minimum total filter)
 * - maxTotal: number (maximum total filter)
 * - paymentMethod: string (filter by payment method)
 * - shippingMethod: string (filter by shipping method)
 * - search: string (search in order number, notes)
 * 
 * Response: PaginatedResponse<Order>
 */
router.get(
  '/',
  authenticate,
  requirePermission('orders', 'read'),
  productRateLimiter,
  validateRequest(listOrdersSchema),
  listOrders
);

/**
 * @route   GET /api/v1/orders/export
 * @desc    Export orders to CSV
 * @access  Private (admin, merchant)
 * @rateLimit 10 requests per 15 minutes
 * 
 * Query Parameters:
 * - status: OrderStatus | OrderStatus[] (filter by status)
 * - startDate: ISO datetime (filter by start date)
 * - endDate: ISO datetime (filter by end date)
 * - userId: UUID (filter by user)
 * 
 * Response: CSV file download
 */
router.get(
  '/export',
  authenticate,
  requirePermission('orders', 'export'),
  exportRateLimiter,
  validateRequest(exportOrdersCSVSchema),
  exportOrdersCSV
);

/**
 * @route   GET /api/v1/orders/analytics
 * @desc    Get order analytics and statistics
 * @access  Private (admin, merchant)
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - startDate: ISO datetime (optional)
 * - endDate: ISO datetime (optional)
 * - groupBy: 'day' | 'week' | 'month' (default: 'day')
 * 
 * Response: OrderAnalytics
 */
router.get(
  '/analytics',
  authenticate,
  requirePermission('orders', 'read'),
  productRateLimiter,
  validateRequest(getOrderAnalyticsSchema),
  getOrderAnalytics
);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get single order by ID with full details
 * @access  Private (admin, merchant, customer - own orders only)
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Order (with items, addresses)
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('orders', 'read'),
  productRateLimiter,
  validateRequest(getOrderSchema),
  getOrder
);

/**
 * @route   POST /api/v1/orders
 * @desc    Create new order with inventory reservation
 * @access  Private (admin, merchant, customer)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: orders:write
 * 
 * Request Body: CreateOrderRequest
 * Response: Order
 */
router.post(
  '/',
  authenticate,
  requirePermission('orders', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(createOrderSchema),
  createOrder
);

/**
 * @route   PUT /api/v1/orders/:id/status
 * @desc    Update order status with state machine validation
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * 
 * Required permissions: orders:write
 * 
 * Request Body: UpdateOrderStatusRequest
 * Response: Order
 */
router.put(
  '/:id/status',
  authenticate,
  requirePermission('orders', 'write'),
  strictRateLimiter,
  validateRequest(updateOrderStatusSchema),
  updateOrderStatus
);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel order with inventory rollback
 * @access  Private (admin, merchant, customer - own orders only)
 * @rateLimit 50 requests per 15 minutes
 * 
 * Required permissions: orders:write
 * 
 * Request Body: CancelOrderRequest
 * Response: Order
 */
router.post(
  '/:id/cancel',
  authenticate,
  requirePermission('orders', 'write'),
  strictRateLimiter,
  validateRequest(cancelOrderSchema),
  cancelOrder
);

export default router;
