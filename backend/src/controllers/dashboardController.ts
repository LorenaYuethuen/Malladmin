/**
 * Dashboard Controller
 * Aggregates data from orders/products for dashboard stats
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';

/** GET /dashboard/stats */
export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [ordersResult, revenueResult, productsResult, usersResult] = await Promise.all([
      db.query(`SELECT COUNT(*) as total FROM orders`),
      db.query(`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status NOT IN ('cancelled')`),
      db.query(`SELECT COUNT(*) as total FROM products`),
      db.query(`SELECT COUNT(DISTINCT user_id) as total FROM orders`),
    ]);

    // Month-over-month comparison
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [thisMonthOrders, lastMonthOrders, thisMonthRevenue, lastMonthRevenue] = await Promise.all([
      db.query(`SELECT COUNT(*) as total FROM orders WHERE created_at >= $1`, [firstOfMonth]),
      db.query(`SELECT COUNT(*) as total FROM orders WHERE created_at >= $1 AND created_at < $2`, [firstOfLastMonth, firstOfMonth]),
      db.query(`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= $1 AND status NOT IN ('cancelled')`, [firstOfMonth]),
      db.query(`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= $1 AND created_at < $2 AND status NOT IN ('cancelled')`, [firstOfLastMonth, firstOfMonth]),
    ]);

    const calcGrowth = (current: number, previous: number) =>
      previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100 * 10) / 10;

    sendSuccess(res, {
      totalOrders: parseInt(ordersResult.rows[0].total),
      totalRevenue: parseFloat(revenueResult.rows[0].total),
      totalProducts: parseInt(productsResult.rows[0].total),
      totalUsers: parseInt(usersResult.rows[0].total),
      totalCustomers: parseInt(usersResult.rows[0].total),
      ordersGrowth: calcGrowth(
        parseInt(thisMonthOrders.rows[0].total),
        parseInt(lastMonthOrders.rows[0].total)
      ),
      orderGrowth: calcGrowth(
        parseInt(thisMonthOrders.rows[0].total),
        parseInt(lastMonthOrders.rows[0].total)
      ),
      revenueGrowth: calcGrowth(
        parseFloat(thisMonthRevenue.rows[0].total),
        parseFloat(lastMonthRevenue.rows[0].total)
      ),
      userGrowth: 0,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /dashboard/sales-trend?period=week|month|year */
export const getSalesTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'week';

    let dateFormat: string;
    let interval: string;

    if (period === 'day') {
      dateFormat = 'HH24:00';
      interval = '1 day';
    } else if (period === 'month') {
      dateFormat = 'YYYY-MM-DD';
      interval = '30 days';
    } else if (period === 'year') {
      dateFormat = 'YYYY-MM';
      interval = '365 days';
    } else {
      // week (default)
      dateFormat = 'YYYY-MM-DD';
      interval = '7 days';
    }

    const result = await db.query(
      `SELECT
        TO_CHAR(created_at, $1) as date,
        COALESCE(SUM(total), 0) as revenue,
        COUNT(*) as orders
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '${interval}'
         AND status NOT IN ('cancelled')
       GROUP BY TO_CHAR(created_at, $1)
       ORDER BY date`,
      [dateFormat]
    );

    sendSuccess(res, result.rows.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders),
    })));
  } catch (error) {
    next(error);
  }
};

/** GET /dashboard/order-status */
export const getOrderStatusDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC`
    );

    sendSuccess(res, result.rows.map(r => ({
      status: r.status,
      count: parseInt(r.count),
    })));
  } catch (error) {
    next(error);
  }
};

/** GET /dashboard/top-products?limit=10 */
export const getTopProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await db.query(
      `SELECT
        oi.product_id as "productId",
        oi.product_name as "productName",
        SUM(oi.quantity) as "totalSold",
        SUM(oi.total) as revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status NOT IN ('cancelled')
       GROUP BY oi.product_id, oi.product_name
       ORDER BY revenue DESC
       LIMIT $1`,
      [limit]
    );

    sendSuccess(res, result.rows.map(r => ({
      id: r.productId,
      name: r.productName,
      salesCount: parseInt(r.totalSold),
      revenue: parseFloat(r.revenue),
    })));
  } catch (error) {
    next(error);
  }
};

/** GET /dashboard/recent-orders?limit=5 */
export const getRecentOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

    const result = await db.query(
      `SELECT
        id,
        order_number as "orderNumber",
        user_id as "userId",
        total,
        status,
        payment_status as "paymentStatus",
        created_at as "createdAt"
       FROM orders
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    sendSuccess(res, result.rows.map(r => ({
      id: r.id,
      orderNo: r.orderNumber,
      customerName: null,
      totalAmount: parseFloat(r.total),
      status: r.status,
      createdAt: r.createdAt,
    })));
  } catch (error) {
    next(error);
  }
};
