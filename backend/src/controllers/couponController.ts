import { Request, Response } from 'express';
import { db } from '../database/connection';
import redis from '../database/redis';
import type {
  Coupon,
  CouponUsage,
  CreateCouponRequest,
  UpdateCouponRequest,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '../types/marketing';

// Redis cache keys
const COUPON_STATS_KEY = (id: string) => `coupon:${id}:stats`;
const COUPON_STATS_TTL = 300; // 5 minutes

/**
 * Build standard API response meta
 */
function buildMeta() {
  return {
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    version: 'v1',
  };
}

/**
 * Get all coupons with filters and pagination
 */
export const getCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      isActive,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT * FROM coupons WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM coupons WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      countQuery += ` AND type = $${paramIndex}`;
      params.push(type);
      countParams.push(type);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      countQuery += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      countParams.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      query += ` AND (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex + 1})`;
      countQuery += ` AND (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    // Get total count
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Validate sort column
    const allowedSortColumns = ['created_at', 'name', 'code', 'start_date', 'end_date', 'used_count'];
    const safeSortBy = allowedSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await db.query(query, params);
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        items: result.rows.map(mapCouponFromDb),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch coupons',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Get coupon by ID
 */
export const getCouponById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    res.json({
      success: true,
      data: mapCouponFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch coupon',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Create new coupon
 */
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateCouponRequest = req.body;

    // Check if code already exists
    const existingCoupon = await db.query(
      'SELECT id FROM coupons WHERE code = $1',
      [data.code]
    );

    if (existingCoupon.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_5000',
          message: 'Coupon code already exists',
          field: 'code',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate <= startDate) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'End date must be after start date',
          field: 'endDate',
        },
        meta: buildMeta(),
      });
      return;
    }

    const result = await db.query(
      `INSERT INTO coupons (
        code, name, description, type, discount_value,
        min_purchase_amount, max_discount_amount, usage_limit,
        per_user_limit, start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.code,
        data.name,
        data.description || null,
        data.type,
        data.discountValue || null,
        data.minPurchaseAmount || 0,
        data.maxDiscountAmount || null,
        data.usageLimit || null,
        data.perUserLimit || 1,
        data.startDate,
        data.endDate,
      ]
    );

    res.status(201).json({
      success: true,
      data: mapCouponFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to create coupon',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Update coupon
 */
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateCouponRequest = req.body;

    // Check coupon exists
    const existing = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(data.type);
    }
    if (data.discountValue !== undefined) {
      updates.push(`discount_value = $${paramIndex++}`);
      params.push(data.discountValue);
    }
    if (data.minPurchaseAmount !== undefined) {
      updates.push(`min_purchase_amount = $${paramIndex++}`);
      params.push(data.minPurchaseAmount);
    }
    if (data.maxDiscountAmount !== undefined) {
      updates.push(`max_discount_amount = $${paramIndex++}`);
      params.push(data.maxDiscountAmount);
    }
    if (data.usageLimit !== undefined) {
      updates.push(`usage_limit = $${paramIndex++}`);
      params.push(data.usageLimit);
    }
    if (data.perUserLimit !== undefined) {
      updates.push(`per_user_limit = $${paramIndex++}`);
      params.push(data.perUserLimit);
    }
    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(data.endDate);
    }
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'No fields to update',
        },
        meta: buildMeta(),
      });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await db.query(
      `UPDATE coupons SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    // Invalidate stats cache
    try {
      await redis.del(COUPON_STATS_KEY(id));
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: mapCouponFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update coupon',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Delete coupon
 */
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM coupons WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate stats cache
    try {
      await redis.del(COUPON_STATS_KEY(id));
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: { id },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to delete coupon',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Toggle coupon active status
 */
export const toggleCouponStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'isActive must be a boolean',
          field: 'isActive',
        },
        meta: buildMeta(),
      });
      return;
    }

    const result = await db.query(
      'UPDATE coupons SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [isActive, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate stats cache
    try {
      await redis.del(COUPON_STATS_KEY(id));
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: mapCouponFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update coupon status',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Get coupon usage statistics
 * Returns usage count, remaining count, usage rate, and recent usage
 */
export const getCouponStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try Redis cache first
    try {
      const cached = await redis.get(COUPON_STATS_KEY(id));
      if (cached) {
        res.json({
          success: true,
          data: JSON.parse(cached),
          meta: buildMeta(),
        });
        return;
      }
    } catch {
      // Redis failure is non-critical, continue to DB
    }

    // Get coupon
    const couponResult = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);
    if (couponResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    const coupon = mapCouponFromDb(couponResult.rows[0]);

    // Get total usage count from coupon_usage table
    const usageCountResult = await db.query(
      'SELECT COUNT(*) as total_usage, COALESCE(SUM(discount_amount), 0) as total_discount FROM coupon_usage WHERE coupon_id = $1',
      [id]
    );
    const totalUsage = parseInt(usageCountResult.rows[0].total_usage);
    const totalDiscount = parseFloat(usageCountResult.rows[0].total_discount);

    // Get unique users count
    const uniqueUsersResult = await db.query(
      'SELECT COUNT(DISTINCT user_id) as unique_users FROM coupon_usage WHERE coupon_id = $1',
      [id]
    );
    const uniqueUsers = parseInt(uniqueUsersResult.rows[0].unique_users);

    // Get daily usage for the last 7 days
    const dailyUsageResult = await db.query(
      `SELECT DATE(used_at) as date, COUNT(*) as count, COALESCE(SUM(discount_amount), 0) as discount_total
       FROM coupon_usage
       WHERE coupon_id = $1 AND used_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(used_at)
       ORDER BY date DESC`,
      [id]
    );

    const remaining = coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : null;
    const usageRate = coupon.usageLimit ? (coupon.usedCount / coupon.usageLimit) * 100 : 0;

    const stats = {
      couponId: id,
      couponCode: coupon.code,
      couponName: coupon.name,
      usageCount: coupon.usedCount,
      totalUsageRecords: totalUsage,
      remainingCount: remaining,
      usageLimit: coupon.usageLimit,
      usageRate: Math.round(usageRate * 100) / 100,
      uniqueUsers,
      totalDiscountAmount: totalDiscount,
      isActive: coupon.isActive,
      isExpired: new Date(coupon.endDate) < new Date(),
      isNotStarted: new Date(coupon.startDate) > new Date(),
      dailyUsage: dailyUsageResult.rows.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count),
        discountTotal: parseFloat(row.discount_total),
      })),
    };

    // Cache the stats
    try {
      await redis.set(COUPON_STATS_KEY(id), JSON.stringify(stats), { EX: COUPON_STATS_TTL });
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: stats,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching coupon stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch coupon statistics',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Validate coupon for use
 * Checks: active status, date validity, min purchase amount, usage limit, per-user limit
 */
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: ValidateCouponRequest = req.body;

    if (!data.code || !data.userId || data.orderAmount === undefined) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'code, userId, and orderAmount are required',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Get coupon by code
    const couponResult = await db.query(
      'SELECT * FROM coupons WHERE code = $1',
      [data.code]
    );

    if (couponResult.rows.length === 0) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Coupon not found',
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    const coupon = mapCouponFromDb(couponResult.rows[0]);

    // Check if coupon is active
    if (!coupon.isActive) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Coupon is inactive',
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    // Check date validity
    const now = new Date();
    if (now < new Date(coupon.startDate)) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Coupon has not started yet',
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    if (now > new Date(coupon.endDate)) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Coupon has expired',
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    // Check total usage limit
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Coupon usage limit reached',
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    // Check per-user limit
    if (coupon.perUserLimit) {
      const userUsageResult = await db.query(
        'SELECT COUNT(*) FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2',
        [coupon.id, data.userId]
      );
      const userUsageCount = parseInt(userUsageResult.rows[0].count);

      if (userUsageCount >= coupon.perUserLimit) {
        res.json({
          success: true,
          data: {
            valid: false,
            message: 'Per-user usage limit reached for this coupon',
          } as ValidateCouponResponse,
          meta: buildMeta(),
        });
        return;
      }
    }

    // Check minimum purchase amount
    if (data.orderAmount < coupon.minPurchaseAmount) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: `Minimum purchase amount is ${coupon.minPurchaseAmount}`,
        } as ValidateCouponResponse,
        meta: buildMeta(),
      });
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === 'percentage' && coupon.discountValue) {
      discountAmount = (data.orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else if (coupon.type === 'fixed' && coupon.discountValue) {
      discountAmount = Math.min(coupon.discountValue, data.orderAmount);
    } else if (coupon.type === 'free_shipping') {
      discountAmount = 0; // Shipping discount handled separately
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      success: true,
      data: {
        valid: true,
        coupon,
        discountAmount,
        message: 'Coupon is valid',
      } as ValidateCouponResponse,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5008',
        message: 'Failed to validate coupon',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Get coupon usage records
 */
export const getCouponUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check coupon exists
    const couponCheck = await db.query('SELECT id FROM coupons WHERE id = $1', [id]);
    if (couponCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5006',
          message: 'Coupon not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM coupon_usage WHERE coupon_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated usage records
    const result = await db.query(
      `SELECT cu.*, u.email, u.username as user_name
       FROM coupon_usage cu
       LEFT JOIN users u ON cu.user_id = u.id
       WHERE cu.coupon_id = $1
       ORDER BY cu.used_at DESC
       LIMIT $2 OFFSET $3`,
      [id, Number(limit), offset]
    );

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        items: result.rows.map(mapCouponUsageFromDb),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching coupon usage:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch coupon usage',
      },
      meta: buildMeta(),
    });
  }
};

// Helper functions
function mapCouponFromDb(row: any): Coupon {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type,
    discountValue: row.discount_value ? parseFloat(row.discount_value) : undefined,
    minPurchaseAmount: parseFloat(row.min_purchase_amount || '0'),
    maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
    usageLimit: row.usage_limit,
    usedCount: row.used_count || 0,
    perUserLimit: row.per_user_limit || 1,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCouponUsageFromDb(row: any): CouponUsage {
  return {
    id: row.id,
    couponId: row.coupon_id,
    userId: row.user_id,
    orderId: row.order_id,
    discountAmount: parseFloat(row.discount_amount),
    usedAt: row.used_at,
    user: row.email ? {
      id: row.user_id,
      email: row.email,
      name: row.user_name,
    } : undefined,
  };
}
