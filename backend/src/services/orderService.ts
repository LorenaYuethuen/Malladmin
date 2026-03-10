/**
 * Order Service
 * 
 * Implements core order management operations including:
 * - Order CRUD with filtering and pagination
 * - Order status management with state machine validation
 * - Shipping management with logistics integration
 * - Return management with approval workflow
 * - Inventory integration for reservation and deduction
 * - Order analytics and reporting
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.9, 2.10, 15.2, 15.3, 16.2, 16.3, 17.1-17.7
 */

import { PoolClient } from 'pg';
import { db } from '../database/connection';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  OrderListQuery,
  OrderAnalytics,
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  isValidStatusTransition,
  generateOrderNumber,
} from '../types/order';
import {
  TrackingStatus,
  AssignTrackingRequest,
} from '../types/shipping';
import {
  ReturnRequest,
  ReturnStatus,
  ProcessReturnRequest,
  ReturnListQuery,
} from '../types/return';
import { cacheService, CacheTTL } from './cacheService';
import { outboxService } from './outboxService';
import { logisticsService } from './logisticsService';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

class OrderService {
  /**
   * Get orders with advanced filtering, sorting, and pagination
   * Supports caching for performance
   */
  async getOrders(query: OrderListQuery): Promise<{
    items: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (query.filters) {
      const { filters } = query;

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          paramCount++;
          conditions.push(`o.status = ANY($${paramCount})`);
          values.push(filters.status);
        } else {
          paramCount++;
          conditions.push(`o.status = $${paramCount}`);
          values.push(filters.status);
        }
      }

      if (filters.paymentStatus) {
        if (Array.isArray(filters.paymentStatus)) {
          paramCount++;
          conditions.push(`o.payment_status = ANY($${paramCount})`);
          values.push(filters.paymentStatus);
        } else {
          paramCount++;
          conditions.push(`o.payment_status = $${paramCount}`);
          values.push(filters.paymentStatus);
        }
      }

      if (filters.userId) {
        paramCount++;
        conditions.push(`o.user_id = $${paramCount}`);
        values.push(filters.userId);
      }

      if (filters.orderNumber) {
        paramCount++;
        conditions.push(`o.order_number = $${paramCount}`);
        values.push(filters.orderNumber);
      }

      if (filters.startDate) {
        paramCount++;
        conditions.push(`o.created_at >= $${paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        conditions.push(`o.created_at <= $${paramCount}`);
        values.push(filters.endDate);
      }

      if (filters.minTotal !== undefined) {
        paramCount++;
        conditions.push(`o.total >= $${paramCount}`);
        values.push(filters.minTotal);
      }

      if (filters.maxTotal !== undefined) {
        paramCount++;
        conditions.push(`o.total <= $${paramCount}`);
        values.push(filters.maxTotal);
      }

      if (filters.paymentMethod) {
        paramCount++;
        conditions.push(`o.payment_method = $${paramCount}`);
        values.push(filters.paymentMethod);
      }

      if (filters.shippingMethod) {
        paramCount++;
        conditions.push(`o.shipping_method = $${paramCount}`);
        values.push(filters.shippingMethod);
      }

      if (filters.search) {
        paramCount++;
        conditions.push(`(
          o.order_number ILIKE $${paramCount} OR
          o.customer_notes ILIKE $${paramCount} OR
          o.admin_notes ILIKE $${paramCount}
        )`);
        values.push(`%${filters.search}%`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get orders
    const ordersQuery = `
      SELECT 
        o.id, o.order_number as "orderNumber", o.user_id as "userId",
        o.subtotal, o.tax, o.shipping_cost as "shippingCost",
        o.discount, o.total,
        o.status, o.payment_method as "paymentMethod",
        o.payment_status as "paymentStatus", o.paid_at as "paidAt",
        o.shipping_method as "shippingMethod",
        o.estimated_delivery_date as "estimatedDeliveryDate",
        o.delivered_at as "deliveredAt",
        o.customer_notes as "customerNotes", o.admin_notes as "adminNotes",
        o.created_at as "createdAt", o.updated_at as "updatedAt",
        o.cancelled_at as "cancelledAt",
        (
          SELECT COUNT(*) FROM order_items WHERE order_id = o.id
        ) as "itemCount"
      FROM orders o
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const ordersResult = await db.query(ordersQuery, [...values, limit, offset]);

    logger.debug('Orders retrieved', {
      page,
      limit,
      total,
      filters: query.filters,
    });

    return {
      items: ordersResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get single order by ID with full details including items and addresses
   * Uses caching for performance
   */
  async getOrder(id: string): Promise<Order> {
    // Try cache first
    const cacheKey = cacheService.order.getDetail(id);
    const cached = await cacheService.get<Order>(cacheKey);
    if (cached) {
      logger.debug('Order retrieved from cache', { orderId: id });
      return cached;
    }

    const query = `
      SELECT 
        o.id, o.order_number as "orderNumber", o.user_id as "userId",
        o.subtotal, o.tax, o.shipping_cost as "shippingCost",
        o.discount, o.total,
        o.status, o.payment_method as "paymentMethod",
        o.payment_status as "paymentStatus", o.paid_at as "paidAt",
        o.shipping_method as "shippingMethod",
        o.estimated_delivery_date as "estimatedDeliveryDate",
        o.delivered_at as "deliveredAt",
        o.customer_notes as "customerNotes", o.admin_notes as "adminNotes",
        o.created_at as "createdAt", o.updated_at as "updatedAt",
        o.cancelled_at as "cancelledAt",
        (
          SELECT json_agg(json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'productName', oi.product_name,
            'productSku', oi.product_sku,
            'productImageUrl', oi.product_image_url,
            'price', oi.price,
            'quantity', oi.quantity,
            'subtotal', oi.subtotal,
            'discount', oi.discount,
            'tax', oi.tax,
            'total', oi.total,
            'status', oi.status,
            'createdAt', oi.created_at,
            'updatedAt', oi.updated_at
          ))
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) as items,
        (
          SELECT json_agg(json_build_object(
            'id', oa.id,
            'addressType', oa.address_type,
            'recipientName', oa.recipient_name,
            'phone', oa.phone,
            'email', oa.email,
            'addressLine1', oa.address_line1,
            'addressLine2', oa.address_line2,
            'city', oa.city,
            'state', oa.state,
            'postalCode', oa.postal_code,
            'country', oa.country,
            'createdAt', oa.created_at
          ))
          FROM order_addresses oa
          WHERE oa.order_id = o.id
        ) as addresses
      FROM orders o
      WHERE o.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Order', id);
    }

    const order = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, order, CacheTTL.ORDER_DETAIL);

    logger.debug('Order retrieved from database', { orderId: id });

    return order;
  }

  /**
   * Update order status with state machine validation
   * Handles inventory deduction and event publishing
   */
  async updateOrderStatus(
    id: string,
    data: UpdateOrderStatusRequest,
    userId?: string
  ): Promise<Order> {
    const client = await db.getClient();

    try {
      // Check if order exists
      const existingOrder = await client.query(
        'SELECT id, status, order_number as "orderNumber", user_id as "userId" FROM orders WHERE id = $1',
        [id]
      );

      if (existingOrder.rows.length === 0) {
        throw new NotFoundError('Order', id);
      }

      const currentStatus = existingOrder.rows[0].status;

      // Validate status transition
      if (!isValidStatusTransition(currentStatus, data.status)) {
        throw new ValidationError(
          `Invalid status transition from ${currentStatus} to ${data.status}`
        );
      }

      await client.query('BEGIN');

      // Update order status
      const updateFields: string[] = ['status = $1', 'updated_at = NOW()'];
      const updateValues: any[] = [data.status];
      let paramCount = 1;

      if (data.adminNotes) {
        paramCount++;
        updateFields.push(`admin_notes = $${paramCount}`);
        updateValues.push(data.adminNotes);
      }

      // Set paid_at timestamp when status changes to paid
      if (data.status === OrderStatus.PAID) {
        updateFields.push('paid_at = NOW()');
        updateFields.push(`payment_status = '${PaymentStatus.COMPLETED}'`);
      }

      // Set delivered_at timestamp when status changes to delivered
      if (data.status === OrderStatus.DELIVERED) {
        updateFields.push('delivered_at = NOW()');
      }

      paramCount++;
      updateValues.push(id);

      const updateQuery = `
        UPDATE orders
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `;

      await client.query(updateQuery, updateValues);

      // If status is confirmed or paid, deduct reserved inventory
      if (data.status === OrderStatus.CONFIRMED || data.status === OrderStatus.PAID) {
        const itemsResult = await client.query(
          'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
          [id]
        );

        for (const item of itemsResult.rows) {
          await client.query(
            `UPDATE product_inventory 
             SET reserved_quantity = reserved_quantity - $1,
                 quantity = quantity - $1
             WHERE product_id = $2`,
            [item.quantity, item.product_id]
          );
        }
      }

      // Write to outbox for event publishing
      const eventType = `ORDER_${data.status.toUpperCase()}` as any;
      await outboxService.writeEvent(client, {
        aggregateType: 'order',
        aggregateId: id,
        eventType,
        payload: {
          orderId: id,
          orderNumber: existingOrder.rows[0].orderNumber,
          userId: existingOrder.rows[0].userId,
          oldStatus: currentStatus,
          newStatus: data.status,
          trackingNumber: data.trackingNumber,
          updatedBy: userId,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.order.invalidateDetail(id);
      await cacheService.order.invalidateUserOrders(existingOrder.rows[0].userId);

      logger.info('Order status updated', {
        orderId: id,
        oldStatus: currentStatus,
        newStatus: data.status,
        updatedBy: userId,
      });

      // Fetch and return the updated order
      return await this.getOrder(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get order analytics with caching
   * Provides comprehensive statistics and insights
   */
  async getOrderAnalytics(
    startDate?: string,
    endDate?: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<OrderAnalytics> {
    // Build cache key
    const cacheKey = cacheService.order.getAnalytics(
      `${startDate || 'all'}-${endDate || 'all'}-${groupBy}`
    );

    // Try cache first
    const cached = await cacheService.get<OrderAnalytics>(cacheKey);
    if (cached) {
      logger.debug('Order analytics retrieved from cache');
      return cached;
    }

    // Build WHERE clause for date filtering
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      conditions.push(`created_at >= $${paramCount}`);
      values.push(startDate);
    }

    if (endDate) {
      paramCount++;
      conditions.push(`created_at <= $${paramCount}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build WHERE clause for JOIN queries (qualify with table alias)
    const joinConditions = conditions.map(c => c.replace('created_at', 'o.created_at'));
    const joinWhereClause = joinConditions.length > 0 ? `WHERE ${joinConditions.join(' AND ')}` : '';

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalOrders",
        COALESCE(SUM(total), 0) as "totalRevenue",
        COALESCE(AVG(total), 0) as "averageOrderValue"
      FROM orders
      ${whereClause}
    `;
    const statsResult = await db.query(statsQuery, values);

    // Get orders by status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY status
    `;
    const statusResult = await db.query(statusQuery, values);
    const ordersByStatus: Record<OrderStatus, number> = {} as any;
    for (const row of statusResult.rows) {
      ordersByStatus[row.status as OrderStatus] = parseInt(row.count);
    }

    // Get orders by payment status
    const paymentStatusQuery = `
      SELECT 
        payment_status as "paymentStatus",
        COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY payment_status
    `;
    const paymentStatusResult = await db.query(paymentStatusQuery, values);
    const ordersByPaymentStatus: Record<PaymentStatus, number> = {} as any;
    for (const row of paymentStatusResult.rows) {
      ordersByPaymentStatus[row.paymentStatus as PaymentStatus] = parseInt(row.count);
    }

    // Get revenue by date
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';
    const revenueByDateQuery = `
      SELECT 
        TO_CHAR(created_at, '${dateFormat}') as date,
        COALESCE(SUM(total), 0) as revenue,
        COUNT(*) as "orderCount"
      FROM orders
      ${whereClause}
      GROUP BY TO_CHAR(created_at, '${dateFormat}')
      ORDER BY date
    `;
    const revenueByDateResult = await db.query(revenueByDateQuery, values);

    // Get top products
    const topProductsQuery = `
      SELECT 
        oi.product_id as "productId",
        oi.product_name as "productName",
        SUM(oi.quantity) as quantity,
        SUM(oi.total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${whereClause}
      GROUP BY oi.product_id, oi.product_name
      ORDER BY revenue DESC
      LIMIT 10
    `;
    const topProductsResult = await db.query(topProductsQuery, values);

    const analytics: OrderAnalytics = {
      totalOrders: parseInt(statsResult.rows[0].totalOrders),
      totalRevenue: parseFloat(statsResult.rows[0].totalRevenue),
      averageOrderValue: parseFloat(statsResult.rows[0].averageOrderValue),
      ordersByStatus,
      ordersByPaymentStatus,
      revenueByDate: revenueByDateResult.rows.map((row: any) => ({
        date: row.date,
        revenue: parseFloat(row.revenue),
        orderCount: parseInt(row.orderCount),
      })),
      topProducts: topProductsResult.rows.map((row: any) => ({
        productId: row.productId,
        productName: row.productName,
        quantity: parseInt(row.quantity),
        revenue: parseFloat(row.revenue),
      })),
    };

    // Cache the result
    await cacheService.set(cacheKey, analytics, CacheTTL.ORDER_ANALYTICS);

    logger.debug('Order analytics calculated', {
      totalOrders: analytics.totalOrders,
      totalRevenue: analytics.totalRevenue,
    });

    return analytics;
  }

  /**
   * Assign tracking number to order and create tracking record
   * Integrates with logistics service
   */
  async assignTracking(
    orderId: string,
    data: AssignTrackingRequest,
    userId?: string
  ): Promise<any> {
    const client = await db.getClient();

    try {
      // Check if order exists and is in correct status
      const orderResult = await client.query(
        'SELECT id, status, order_number as "orderNumber", user_id as "userId" FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new NotFoundError('Order', orderId);
      }

      const order = orderResult.rows[0];

      // Validate order status (should be processing or paid)
      if (order.status !== OrderStatus.PROCESSING && order.status !== OrderStatus.PAID) {
        throw new ValidationError(
          `Cannot assign tracking to order with status ${order.status}. Order must be in processing or paid status.`
        );
      }

      // Validate tracking number format
      if (!logisticsService.validateTrackingNumber(data.trackingNumber, data.carrier)) {
        throw new ValidationError(
          `Invalid tracking number format for carrier ${data.carrier}`
        );
      }

      await client.query('BEGIN');

      // Check if tracking already exists
      const existingTracking = await client.query(
        'SELECT id FROM order_tracking WHERE order_id = $1',
        [orderId]
      );

      let trackingId: string;

      if (existingTracking.rows.length > 0) {
        // Update existing tracking
        const updateResult = await client.query(
          `UPDATE order_tracking
           SET tracking_number = $1, carrier = $2, shipping_method = $3,
               status = $4, shipped_at = NOW(), updated_at = NOW()
           WHERE order_id = $5
           RETURNING id`,
          [
            data.trackingNumber,
            data.carrier,
            data.shippingMethod || null,
            TrackingStatus.PICKED_UP,
            orderId,
          ]
        );
        trackingId = updateResult.rows[0].id;
      } else {
        // Create new tracking record
        const insertResult = await client.query(
          `INSERT INTO order_tracking (
            order_id, tracking_number, carrier, shipping_method,
            status, shipped_at, estimated_delivery_date
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
          RETURNING id`,
          [
            orderId,
            data.trackingNumber,
            data.carrier,
            data.shippingMethod || null,
            TrackingStatus.PICKED_UP,
            data.estimatedDeliveryDate || null,
          ]
        );
        trackingId = insertResult.rows[0].id;
      }

      // Add initial tracking update
      await client.query(
        `INSERT INTO tracking_updates (
          tracking_id, status, location, description, occurred_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          trackingId,
          TrackingStatus.PICKED_UP,
          '仓库',
          `[${data.carrier}] 快递已揽收`,
        ]
      );

      // Update order status to shipped
      await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [OrderStatus.SHIPPED, orderId]
      );

      // Write to outbox for event publishing
      await outboxService.writeEvent(client, {
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: 'ORDER_SHIPPED',
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          userId: order.userId,
          trackingNumber: data.trackingNumber,
          carrier: data.carrier,
          assignedBy: userId,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.order.invalidateDetail(orderId);
      await cacheService.order.invalidateUserOrders(order.userId);

      logger.info('Tracking assigned to order', {
        orderId,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        assignedBy: userId,
      });

      // Fetch and return tracking info
      const trackingResult = await db.query(
        `SELECT 
          id, order_id as "orderId", tracking_number as "trackingNumber",
          carrier, shipping_method as "shippingMethod", status,
          shipped_at as "shippedAt", estimated_delivery_date as "estimatedDeliveryDate",
          delivered_at as "deliveredAt", created_at as "createdAt",
          updated_at as "updatedAt"
         FROM order_tracking
         WHERE id = $1`,
        [trackingId]
      );

      return trackingResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update shipping status with logistics API integration
   * Fetches latest tracking information from carrier
   */
  async updateShippingStatus(
    orderId: string,
    data: any,
    userId?: string
  ): Promise<any> {
    const client = await db.getClient();

    try {
      // Get tracking record
      const trackingResult = await client.query(
        `SELECT 
          ot.id, ot.order_id as "orderId", ot.tracking_number as "trackingNumber",
          ot.carrier, ot.status, o.order_number as "orderNumber", o.user_id as "userId"
         FROM order_tracking ot
         JOIN orders o ON ot.order_id = o.id
         WHERE ot.order_id = $1`,
        [orderId]
      );

      if (trackingResult.rows.length === 0) {
        throw new NotFoundError('Tracking information', orderId);
      }

      const tracking = trackingResult.rows[0];

      await client.query('BEGIN');

      // If refreshFromCarrier is true, fetch latest info from logistics API
      if (data.refreshFromCarrier) {
        const logisticsInfo = await logisticsService.refreshTracking(
          tracking.trackingNumber,
          tracking.carrier
        );

        // Update tracking status
        await client.query(
          `UPDATE order_tracking
           SET status = $1, updated_at = NOW(),
               ${logisticsInfo.deliveredAt ? 'delivered_at = $4,' : ''}
               ${logisticsInfo.estimatedDeliveryDate ? 'estimated_delivery_date = $5' : ''}
           WHERE id = $2`,
          [
            logisticsInfo.status,
            tracking.id,
            logisticsInfo.deliveredAt,
            logisticsInfo.estimatedDeliveryDate,
          ].filter(v => v !== undefined)
        );

        // Add tracking updates
        for (const update of logisticsInfo.updates) {
          await client.query(
            `INSERT INTO tracking_updates (
              tracking_id, status, location, description, occurred_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING`,
            [
              tracking.id,
              update.status,
              update.location,
              update.description,
              update.occurredAt,
            ]
          );
        }

        // Update order status if delivered
        if (logisticsInfo.status === TrackingStatus.DELIVERED) {
          await client.query(
            `UPDATE orders
             SET status = $1, delivered_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [OrderStatus.DELIVERED, orderId]
          );

          // Write to outbox
          await outboxService.writeEvent(client, {
            aggregateType: 'order',
            aggregateId: orderId,
            eventType: 'ORDER_DELIVERED',
            payload: {
              orderId,
              orderNumber: tracking.orderNumber,
              userId: tracking.userId,
              trackingNumber: tracking.trackingNumber,
              carrier: tracking.carrier,
            },
          });
        }
      } else {
        // Manual status update
        await client.query(
          `UPDATE order_tracking
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [data.status, tracking.id]
        );

        // Add tracking update
        if (data.location || data.description) {
          await client.query(
            `INSERT INTO tracking_updates (
              tracking_id, status, location, description, occurred_at
            ) VALUES ($1, $2, $3, $4, NOW())`,
            [
              tracking.id,
              data.status,
              data.location || null,
              data.description || null,
            ]
          );
        }

        // Update order status if delivered
        if (data.status === TrackingStatus.DELIVERED) {
          await client.query(
            `UPDATE orders
             SET status = $1, delivered_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [OrderStatus.DELIVERED, orderId]
          );

          // Write to outbox
          await outboxService.writeEvent(client, {
            aggregateType: 'order',
            aggregateId: orderId,
            eventType: 'ORDER_DELIVERED',
            payload: {
              orderId,
              orderNumber: tracking.orderNumber,
              userId: tracking.userId,
              trackingNumber: tracking.trackingNumber,
              carrier: tracking.carrier,
              updatedBy: userId,
            },
          });
        }
      }

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.order.invalidateDetail(orderId);
      await cacheService.order.invalidateUserOrders(tracking.userId);

      logger.info('Shipping status updated', {
        orderId,
        trackingNumber: tracking.trackingNumber,
        newStatus: data.status || 'refreshed',
        updatedBy: userId,
      });

      // Fetch and return updated tracking info
      const updatedTracking = await db.query(
        `SELECT 
          id, order_id as "orderId", tracking_number as "trackingNumber",
          carrier, shipping_method as "shippingMethod", status,
          shipped_at as "shippedAt", estimated_delivery_date as "estimatedDeliveryDate",
          delivered_at as "deliveredAt", created_at as "createdAt",
          updated_at as "updatedAt"
         FROM order_tracking
         WHERE id = $1`,
        [tracking.id]
      );

      return updatedTracking.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get return requests with filtering and pagination
   */
  async getReturns(query: ReturnListQuery): Promise<{
    items: ReturnRequest[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = query.sortBy || 'requested_at';
    const sortOrder = query.sortOrder || 'desc';

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (query.filters) {
      const { filters } = query;

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          paramCount++;
          conditions.push(`rr.status = ANY($${paramCount})`);
          values.push(filters.status);
        } else {
          paramCount++;
          conditions.push(`rr.status = $${paramCount}`);
          values.push(filters.status);
        }
      }

      if (filters.userId) {
        paramCount++;
        conditions.push(`rr.user_id = $${paramCount}`);
        values.push(filters.userId);
      }

      if (filters.orderId) {
        paramCount++;
        conditions.push(`rr.order_id = $${paramCount}`);
        values.push(filters.orderId);
      }

      if (filters.returnNumber) {
        paramCount++;
        conditions.push(`rr.return_number = $${paramCount}`);
        values.push(filters.returnNumber);
      }

      if (filters.startDate) {
        paramCount++;
        conditions.push(`rr.requested_at >= $${paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        conditions.push(`rr.requested_at <= $${paramCount}`);
        values.push(filters.endDate);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM return_requests rr
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get returns
    const returnsQuery = `
      SELECT 
        rr.id, rr.return_number as "returnNumber",
        rr.order_id as "orderId", rr.user_id as "userId",
        rr.status, rr.reason, rr.description,
        rr.refund_amount as "refundAmount",
        rr.refund_method as "refundMethod",
        rr.refund_status as "refundStatus",
        rr.admin_notes as "adminNotes",
        rr.requested_at as "requestedAt",
        rr.approved_at as "approvedAt",
        rr.rejected_at as "rejectedAt",
        rr.completed_at as "completedAt",
        rr.created_at as "createdAt",
        rr.updated_at as "updatedAt",
        o.order_number as "orderNumber",
        (
          SELECT COUNT(*) FROM return_items WHERE return_request_id = rr.id
        ) as "itemCount"
      FROM return_requests rr
      JOIN orders o ON rr.order_id = o.id
      ${whereClause}
      ORDER BY rr.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const returnsResult = await db.query(returnsQuery, [...values, limit, offset]);

    logger.debug('Returns retrieved', {
      page,
      limit,
      total,
      filters: query.filters,
    });

    return {
      items: returnsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Process return request (approve, reject, or complete)
   * Handles inventory restoration and refund processing
   */
  async processReturn(
    returnId: string,
    data: ProcessReturnRequest,
    userId?: string
  ): Promise<ReturnRequest> {
    const client = await db.getClient();

    try {
      // Get return request
      const returnResult = await client.query(
        `SELECT 
          rr.id, rr.return_number as "returnNumber", rr.order_id as "orderId",
          rr.user_id as "userId", rr.status, rr.refund_amount as "refundAmount",
          o.order_number as "orderNumber"
         FROM return_requests rr
         JOIN orders o ON rr.order_id = o.id
         WHERE rr.id = $1`,
        [returnId]
      );

      if (returnResult.rows.length === 0) {
        throw new NotFoundError('Return request', returnId);
      }

      const returnRequest = returnResult.rows[0];

      // Validate status transition
      if (returnRequest.status === ReturnStatus.COMPLETED || returnRequest.status === ReturnStatus.CANCELLED) {
        throw new ValidationError(
          `Cannot process return with status ${returnRequest.status}`
        );
      }

      await client.query('BEGIN');

      let updateQuery = '';
      let updateValues: any[] = [];

      if (data.action === 'approve') {
        // Approve return
        updateQuery = `
          UPDATE return_requests
          SET status = $1, approved_at = NOW(), admin_notes = $2, updated_at = NOW()
          WHERE id = $3
        `;
        updateValues = [ReturnStatus.APPROVED, data.adminNotes || null, returnId];

        // Update return items status
        await client.query(
          `UPDATE return_items
           SET status = 'approved', updated_at = NOW()
           WHERE return_request_id = $1`,
          [returnId]
        );
      } else if (data.action === 'reject') {
        // Reject return
        updateQuery = `
          UPDATE return_requests
          SET status = $1, rejected_at = NOW(), admin_notes = $2, updated_at = NOW()
          WHERE id = $3
        `;
        updateValues = [ReturnStatus.REJECTED, data.adminNotes || null, returnId];

        // Update return items status
        await client.query(
          `UPDATE return_items
           SET status = 'rejected', updated_at = NOW()
           WHERE return_request_id = $1`,
          [returnId]
        );
      } else if (data.action === 'complete') {
        // Complete return and process refund
        if (returnRequest.status !== ReturnStatus.APPROVED) {
          throw new ValidationError('Return must be approved before completion');
        }

        updateQuery = `
          UPDATE return_requests
          SET status = $1, completed_at = NOW(), refund_status = $2,
              admin_notes = $3, updated_at = NOW()
          WHERE id = $4
        `;
        updateValues = [
          ReturnStatus.COMPLETED,
          'completed',
          data.adminNotes || null,
          returnId,
        ];

        // Update return items status
        await client.query(
          `UPDATE return_items
           SET status = 'refunded', updated_at = NOW()
           WHERE return_request_id = $1`,
          [returnId]
        );

        // Restore inventory for returned items
        const returnItems = await client.query(
          `SELECT ri.order_item_id, ri.quantity, oi.product_id
           FROM return_items ri
           JOIN order_items oi ON ri.order_item_id = oi.id
           WHERE ri.return_request_id = $1`,
          [returnId]
        );

        for (const item of returnItems.rows) {
          await client.query(
            `UPDATE product_inventory
             SET quantity = quantity + $1,
                 available_quantity = available_quantity + $1
             WHERE product_id = $2`,
            [item.quantity, item.product_id]
          );
        }

        // Update order status to refunded if full refund
        const orderTotal = await client.query(
          'SELECT total FROM orders WHERE id = $1',
          [returnRequest.orderId]
        );

        if (returnRequest.refundAmount >= orderTotal.rows[0].total) {
          await client.query(
            `UPDATE orders
             SET status = $1, payment_status = $2, updated_at = NOW()
             WHERE id = $3`,
            [OrderStatus.REFUNDED, PaymentStatus.REFUNDED, returnRequest.orderId]
          );
        } else {
          await client.query(
            `UPDATE orders
             SET payment_status = $1, updated_at = NOW()
             WHERE id = $2`,
            [PaymentStatus.PARTIALLY_REFUNDED, returnRequest.orderId]
          );
        }
      }

      await client.query(updateQuery, updateValues);

      // Write to outbox for event publishing
      const eventType = `RETURN_${data.action.toUpperCase()}D` as any;
      await outboxService.writeEvent(client, {
        aggregateType: 'return',
        aggregateId: returnId,
        eventType,
        payload: {
          returnId,
          returnNumber: returnRequest.returnNumber,
          orderId: returnRequest.orderId,
          orderNumber: returnRequest.orderNumber,
          userId: returnRequest.userId,
          action: data.action,
          refundAmount: returnRequest.refundAmount,
          processedBy: userId,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.order.invalidateDetail(returnRequest.orderId);
      await cacheService.order.invalidateUserOrders(returnRequest.userId);

      logger.info('Return processed', {
        returnId,
        returnNumber: returnRequest.returnNumber,
        action: data.action,
        processedBy: userId,
      });

      // Fetch and return updated return request
      const updatedReturn = await db.query(
        `SELECT 
          rr.id, rr.return_number as "returnNumber",
          rr.order_id as "orderId", rr.user_id as "userId",
          rr.status, rr.reason, rr.description,
          rr.refund_amount as "refundAmount",
          rr.refund_method as "refundMethod",
          rr.refund_status as "refundStatus",
          rr.admin_notes as "adminNotes",
          rr.requested_at as "requestedAt",
          rr.approved_at as "approvedAt",
          rr.rejected_at as "rejectedAt",
          rr.completed_at as "completedAt",
          rr.created_at as "createdAt",
          rr.updated_at as "updatedAt"
         FROM return_requests rr
         WHERE rr.id = $1`,
        [returnId]
      );

      return updatedReturn.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reserve inventory for order items
   * Called during order creation
   */
  async reserveInventory(
    client: PoolClient,
    productId: string,
    quantity: number
  ): Promise<void> {
    // Check available inventory
    const inventoryResult = await client.query(
      'SELECT available_quantity FROM product_inventory WHERE product_id = $1',
      [productId]
    );

    if (inventoryResult.rows.length === 0) {
      throw new NotFoundError('Product inventory', productId);
    }

    const availableQuantity = inventoryResult.rows[0].available_quantity;

    if (availableQuantity < quantity) {
      throw new ValidationError(
        `Insufficient inventory. Available: ${availableQuantity}, Requested: ${quantity}`
      );
    }

    // Reserve inventory
    await client.query(
      `UPDATE product_inventory
       SET reserved_quantity = reserved_quantity + $1,
           available_quantity = available_quantity - $1
       WHERE product_id = $2`,
      [quantity, productId]
    );

    logger.debug('Inventory reserved', { productId, quantity });
  }

  /**
   * Deduct inventory after order confirmation/payment
   * Called during order status update
   */
  async deductInventory(
    client: PoolClient,
    productId: string,
    quantity: number
  ): Promise<void> {
    await client.query(
      `UPDATE product_inventory
       SET reserved_quantity = reserved_quantity - $1,
           quantity = quantity - $1
       WHERE product_id = $2`,
      [quantity, productId]
    );

    logger.debug('Inventory deducted', { productId, quantity });
  }

  /**
   * Validate stock availability before order confirmation
   */
  async validateStock(productId: string, quantity: number): Promise<boolean> {
    const result = await db.query(
      'SELECT available_quantity FROM product_inventory WHERE product_id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].available_quantity >= quantity;
  }
}

export const orderService = new OrderService();
export default orderService;
