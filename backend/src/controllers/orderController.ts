/**
 * Order Controller
 * Handles all order-related HTTP requests with CRUD operations
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../types';
import {
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  CancelOrderRequest,
  OrderListQuery,
  generateOrderNumber,
  isValidStatusTransition,
  OrderStatus,
  PaymentStatus,
} from '../types/order';
import {
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { cacheService, CacheTTL } from '../services/cacheService';
import { outboxService } from '../services/outboxService';
import logger from '../utils/logger';

/**
 * List orders with filtering, sorting, and pagination
 * GET /api/v1/orders
 */
export const listOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = req.query as any;

    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = q.sortBy || 'created_at';
    const sortOrder = q.sortOrder || 'desc';

    // Support both flat params and nested filters object
    const filters = (q.filters && typeof q.filters === 'object') ? q.filters : q;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      conditions.push(`o.status = $${paramCount}`);
      values.push(filters.status);
    }
    if (filters.paymentStatus) {
      paramCount++;
      conditions.push(`o.payment_status = $${paramCount}`);
      values.push(filters.paymentStatus);
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
    if (filters.search) {
      paramCount++;
      conditions.push(`(o.order_number ILIKE $${paramCount} OR o.customer_notes ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) as total FROM orders o ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].total);

    const ordersResult = await db.query(`
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
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as "itemCount"
      FROM orders o
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...values, limit, offset]);

    sendSuccess(res, {
      items: ordersResult.rows,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get single order by ID with full details
 * GET /api/v1/orders/:id
 */
export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

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

    logger.info('Order retrieved', { orderId: id });

    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
};


/**
 * Create new order with inventory reservation and idempotency
 * POST /api/v1/orders
 */
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const data: CreateOrderRequest = req.body;

    // Generate unique order number
    const orderNumber = generateOrderNumber();

    await client.query('BEGIN');

    // Fetch product details and validate inventory
    const productIds = data.items.map(item => item.productId);
    const productsQuery = `
      SELECT 
        p.id, p.name, p.sku, p.price, p.sale_price as "salePrice",
        pi.quantity, pi.available_quantity as "availableQuantity",
        (
          SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1
        ) as "imageUrl"
      FROM products p
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      WHERE p.id = ANY($1)
    `;
    const productsResult = await client.query(productsQuery, [productIds]);
    
    interface ProductRow {
      id: string;
      name: string;
      sku: string;
      price: number;
      salePrice: number | null;
      quantity: number;
      availableQuantity: number;
      imageUrl: string | null;
    }
    
    const products = new Map<string, ProductRow>(
      productsResult.rows.map((p: ProductRow) => [p.id, p])
    );

    // Validate all products exist and have sufficient inventory
    let subtotal = 0;
    const orderItems = [];

    for (const item of data.items) {
      const product = products.get(item.productId);
      if (!product) {
        throw new NotFoundError('Product', item.productId);
      }

      if (product.availableQuantity < item.quantity) {
        throw new ValidationError(
          `Insufficient inventory for product ${product.name}. Available: ${product.availableQuantity}, Requested: ${item.quantity}`
        );
      }

      const price = item.price || product.salePrice || product.price;
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        productSku: product.sku,
        productImageUrl: product.imageUrl,
        price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        discount: 0,
        tax: 0,
        total: itemSubtotal,
      });

      // Reserve inventory
      await client.query(
        `UPDATE product_inventory 
         SET reserved_quantity = reserved_quantity + $1,
             available_quantity = available_quantity - $1
         WHERE product_id = $2`,
        [item.quantity, item.productId]
      );
    }

    // Calculate totals (simplified - in production, apply tax rules and shipping calculations)
    const tax = subtotal * 0.1; // 10% tax
    const shippingCost = 10; // Flat rate shipping
    const discount = 0; // Apply coupon logic here
    const total = subtotal + tax + shippingCost - discount;

    // Insert order
    const orderQuery = `
      INSERT INTO orders (
        order_number, user_id, subtotal, tax, shipping_cost, discount, total,
        status, payment_method, payment_status, shipping_method,
        customer_notes, estimated_delivery_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id
    `;

    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

    const orderResult = await client.query(orderQuery, [
      orderNumber,
      data.userId,
      subtotal,
      tax,
      shippingCost,
      discount,
      total,
      OrderStatus.PENDING,
      data.paymentMethod,
      PaymentStatus.PENDING,
      data.shippingMethod,
      data.customerNotes || null,
      estimatedDeliveryDate,
    ]);

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_sku, product_image_url,
          price, quantity, subtotal, discount, tax, total, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          orderId,
          item.productId,
          item.productName,
          item.productSku,
          item.productImageUrl,
          item.price,
          item.quantity,
          item.subtotal,
          item.discount,
          item.tax,
          item.total,
          'pending',
        ]
      );
    }

    // Insert shipping address
    await client.query(
      `INSERT INTO order_addresses (
        order_id, address_type, recipient_name, phone, email,
        address_line1, address_line2, city, state, postal_code, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        orderId,
        'shipping',
        data.shippingAddress.recipientName,
        data.shippingAddress.phone,
        data.shippingAddress.email || null,
        data.shippingAddress.addressLine1,
        data.shippingAddress.addressLine2 || null,
        data.shippingAddress.city,
        data.shippingAddress.state,
        data.shippingAddress.postalCode,
        data.shippingAddress.country,
      ]
    );

    // Insert billing address if provided
    if (data.billingAddress) {
      await client.query(
        `INSERT INTO order_addresses (
          order_id, address_type, recipient_name, phone, email,
          address_line1, address_line2, city, state, postal_code, country
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          orderId,
          'billing',
          data.billingAddress.recipientName,
          data.billingAddress.phone,
          data.billingAddress.email || null,
          data.billingAddress.addressLine1,
          data.billingAddress.addressLine2 || null,
          data.billingAddress.city,
          data.billingAddress.state,
          data.billingAddress.postalCode,
          data.billingAddress.country,
        ]
      );
    }

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'order',
      aggregateId: orderId,
      eventType: 'ORDER_CREATED',
      payload: {
        orderId,
        orderNumber,
        userId: data.userId,
        total,
        status: OrderStatus.PENDING,
        itemCount: orderItems.length,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.order.invalidateUserOrders(data.userId);

    logger.info('Order created', {
      orderId,
      orderNumber,
      userId: data.userId,
      total,
      itemCount: orderItems.length,
    });

    // Fetch and return the created order
    const createdOrder = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    sendSuccess(res, createdOrder.rows[0], 'Order created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};


/**
 * Update order status with state machine validation
 * PUT /api/v1/orders/:id/status
 */
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data: UpdateOrderStatusRequest = req.body;

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
        updatedBy: authReq.user?.id,
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
      updatedBy: authReq.user?.id,
    });

    // Fetch and return the updated order
    const updatedOrder = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    sendSuccess(res, updatedOrder.rows[0], 'Order status updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};


/**
 * Cancel order with inventory rollback
 * POST /api/v1/orders/:id/cancel
 */
export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data: CancelOrderRequest = req.body;

    // Check if order exists
    const existingOrder = await client.query(
      'SELECT id, status, order_number as "orderNumber", user_id as "userId" FROM orders WHERE id = $1',
      [id]
    );

    if (existingOrder.rows.length === 0) {
      throw new NotFoundError('Order', id);
    }

    const currentStatus = existingOrder.rows[0].status;

    // Check if order can be cancelled
    if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.DELIVERED) {
      throw new ValidationError(`Cannot cancel order with status ${currentStatus}`);
    }

    await client.query('BEGIN');

    // Update order status to cancelled
    await client.query(
      `UPDATE orders
       SET status = $1, cancelled_at = NOW(), admin_notes = $2, updated_at = NOW()
       WHERE id = $3`,
      [OrderStatus.CANCELLED, data.adminNotes || data.reason, id]
    );

    // Release reserved inventory
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id]
    );

    for (const item of itemsResult.rows) {
      // If order was confirmed/paid, restore quantity
      if (currentStatus === OrderStatus.CONFIRMED || currentStatus === OrderStatus.PAID || currentStatus === OrderStatus.PROCESSING) {
        await client.query(
          `UPDATE product_inventory 
           SET quantity = quantity + $1,
               available_quantity = available_quantity + $1
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      } else {
        // Otherwise, just release reservation
        await client.query(
          `UPDATE product_inventory 
           SET reserved_quantity = reserved_quantity - $1,
               available_quantity = available_quantity + $1
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'order',
      aggregateId: id,
      eventType: 'ORDER_CANCELLED',
      payload: {
        orderId: id,
        orderNumber: existingOrder.rows[0].orderNumber,
        userId: existingOrder.rows[0].userId,
        previousStatus: currentStatus,
        reason: data.reason,
        cancelledBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.order.invalidateDetail(id);
    await cacheService.order.invalidateUserOrders(existingOrder.rows[0].userId);

    logger.info('Order cancelled', {
      orderId: id,
      previousStatus: currentStatus,
      reason: data.reason,
      cancelledBy: authReq.user?.id,
    });

    // Fetch and return the updated order
    const updatedOrder = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    sendSuccess(res, updatedOrder.rows[0], 'Order cancelled successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};


/**
 * Export orders to CSV
 * GET /api/v1/orders/export
 */
export const exportOrdersCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, startDate, endDate, userId } = req.query;

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        paramCount++;
        conditions.push(`status = ANY($${paramCount})`);
        values.push(status.split(','));
      } else {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(status);
      }
    }

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

    if (userId) {
      paramCount++;
      conditions.push(`user_id = $${paramCount}`);
      values.push(userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        order_number as "Order Number",
        user_id as "User ID",
        status as "Status",
        payment_status as "Payment Status",
        payment_method as "Payment Method",
        shipping_method as "Shipping Method",
        subtotal as "Subtotal",
        tax as "Tax",
        shipping_cost as "Shipping Cost",
        discount as "Discount",
        total as "Total",
        created_at as "Created At",
        paid_at as "Paid At",
        delivered_at as "Delivered At"
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, values);

    // Generate CSV
    if (result.rows.length === 0) {
      sendSuccess(res, { message: 'No orders found for export' });
      return;
    }

    const headers = Object.keys(result.rows[0]);
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    res.send(csv);

    logger.info('Orders exported to CSV', {
      count: result.rows.length,
      filters: { status, startDate, endDate, userId },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get order analytics
 * GET /api/v1/orders/analytics
 */
export const getOrderAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Build cache key
    const cacheKey = cacheService.order.getAnalytics(
      `${startDate || 'all'}-${endDate || 'all'}-${groupBy}`
    );

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
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

    // Get overall statistics (total count, total sales, average amount)
    const statsQuery = `
      SELECT
        COUNT(*) as "totalOrders",
        COALESCE(SUM(total), 0) as "totalRevenue",
        COALESCE(AVG(total), 0) as "averageOrderValue"
      FROM orders
      ${whereClause}
    `;
    const statsResult = await db.query(statsQuery, values);

    // Get order status distribution
    const statusQuery = `
      SELECT
        status,
        COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY status
    `;
    const statusResult = await db.query(statusQuery, values);
    const ordersByStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      ordersByStatus[row.status] = parseInt(row.count);
    }

    // Get payment status distribution
    const paymentStatusQuery = `
      SELECT
        payment_status as "paymentStatus",
        COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY payment_status
    `;
    const paymentStatusResult = await db.query(paymentStatusQuery, values);
    const ordersByPaymentStatus: Record<string, number> = {};
    for (const row of paymentStatusResult.rows) {
      ordersByPaymentStatus[row.paymentStatus] = parseInt(row.count);
    }

    // Get sales trend data (by day/week/month)
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

    // Get top products by revenue
    const topProductsQuery = `
      SELECT
        oi.product_id as "productId",
        oi.product_name as "productName",
        SUM(oi.quantity) as quantity,
        SUM(oi.total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${joinWhereClause}
      GROUP BY oi.product_id, oi.product_name
      ORDER BY revenue DESC
      LIMIT 10
    `;
    const topProductsResult = await db.query(topProductsQuery, values);

    const analytics = {
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

    // Cache the result (TTL 5 minutes)
    await cacheService.set(cacheKey, analytics, CacheTTL.ORDER_ANALYTICS);

    logger.info('Order analytics retrieved', {
      startDate,
      endDate,
      groupBy,
      totalOrders: analytics.totalOrders,
    });

    sendSuccess(res, analytics);
  } catch (error) {
    next(error);
  }
};
