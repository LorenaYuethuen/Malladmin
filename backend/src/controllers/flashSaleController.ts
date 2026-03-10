import { Request, Response } from 'express';
import { db } from '../database/connection';
import redis from '../database/redis';
import type {
  FlashSale,
  FlashSaleProduct,
  CreateFlashSaleRequest,
  UpdateFlashSaleRequest,
} from '../types/marketing';

// Redis key helpers
const FLASH_STOCK_KEY = (saleId: string, productId: string) =>
  `flash:${saleId}:${productId}:stock`;
const FLASH_USER_KEY = (saleId: string, userId: string, productId: string) =>
  `flash:${saleId}:user:${userId}:${productId}`;

// Lua script for atomic stock deduction
const DEDUCT_STOCK_SCRIPT = `
  local key = KEYS[1]
  local quantity = tonumber(ARGV[1])
  local stock = tonumber(redis.call('get', key) or 0)
  if stock >= quantity then
    redis.call('decrby', key, quantity)
    return 1
  else
    return 0
  end
`;

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
 * Get all flash sales with filters and pagination
 */
export const getFlashSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      isActive,
      search,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive === 'true');
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex++})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM flash_sales ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / Number(limit));

    // Get paginated results
    const dataParams = [...params, Number(limit), offset];
    const result = await db.query(
      `SELECT * FROM flash_sales ${whereClause} ORDER BY start_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      dataParams
    );

    res.json({
      success: true,
      data: {
        items: result.rows.map(mapFlashSaleFromDb),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching flash sales:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch flash sales',
      },
      meta: buildMeta(),
    });
  }
};


/**
 * Get flash sale by ID with associated products
 */
export const getFlashSaleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM flash_sales WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    const flashSale = mapFlashSaleFromDb(result.rows[0]);

    // Get associated products with product details
    const productsResult = await db.query(
      `SELECT fsp.*, p.name as product_name, p.sku,
              (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as image_url
       FROM flash_sale_products fsp
       JOIN products p ON fsp.product_id = p.id
       WHERE fsp.flash_sale_id = $1
       ORDER BY fsp.created_at`,
      [id]
    );

    flashSale.products = productsResult.rows.map(mapFlashSaleProductFromDb);

    res.json({
      success: true,
      data: flashSale,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to fetch flash sale' },
      meta: buildMeta(),
    });
  }
};

/**
 * Create a new flash sale
 */
export const createFlashSale = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const data: CreateFlashSaleRequest = req.body;

    // Validate time range
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'End time must be after start time' },
        meta: buildMeta(),
      });
      return;
    }

    const result = await client.query(
      `INSERT INTO flash_sales (
        name, description, start_time, end_time,
        discount_type, discount_value, max_quantity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.name,
        data.description || null,
        data.startTime,
        data.endTime,
        data.discountType,
        data.discountValue,
        data.maxQuantity || null,
      ]
    );

    const flashSale = mapFlashSaleFromDb(result.rows[0]);

    // Add products if provided
    if (data.productIds && data.productIds.length > 0) {
      for (const productId of data.productIds) {
        const productResult = await client.query(
          'SELECT price FROM products WHERE id = $1',
          [productId]
        );

        if (productResult.rows.length > 0) {
          const originalPrice = parseFloat(productResult.rows[0].price);
          let salePrice = originalPrice;

          if (data.discountType === 'percentage') {
            salePrice = originalPrice * (1 - data.discountValue / 100);
          } else if (data.discountType === 'fixed') {
            salePrice = Math.max(0, originalPrice - data.discountValue);
          }

          await client.query(
            `INSERT INTO flash_sale_products (
              flash_sale_id, product_id, original_price, sale_price
            ) VALUES ($1, $2, $3, $4)`,
            [flashSale.id, productId, originalPrice, Math.round(salePrice * 100) / 100]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: flashSale,
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to create flash sale' },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Update an existing flash sale
 */
export const updateFlashSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateFlashSaleRequest = req.body;

    // Check flash sale exists
    const existing = await db.query('SELECT * FROM flash_sales WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    // Don't allow editing active or ended flash sales (except isActive toggle)
    const currentStatus = existing.rows[0].status;
    if (currentStatus === 'active' || currentStatus === 'ended') {
      const allowedFields = ['isActive'];
      const hasDisallowedFields = Object.keys(data).some(
        (k) => !allowedFields.includes(k) && data[k as keyof UpdateFlashSaleRequest] !== undefined
      );
      if (hasDisallowedFields) {
        res.status(400).json({
          success: false,
          error: { code: 'ERR_5000', message: 'Cannot modify an active or ended flash sale' },
          meta: buildMeta(),
        });
        return;
      }
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
    if (data.startTime !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(data.startTime);
    }
    if (data.endTime !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(data.endTime);
    }
    if (data.discountValue !== undefined) {
      updates.push(`discount_value = $${paramIndex++}`);
      params.push(data.discountValue);
    }
    if (data.maxQuantity !== undefined) {
      updates.push(`max_quantity = $${paramIndex++}`);
      params.push(data.maxQuantity);
    }
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'No fields to update' },
        meta: buildMeta(),
      });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await db.query(
      `UPDATE flash_sales SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json({
      success: true,
      data: mapFlashSaleFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error updating flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to update flash sale' },
      meta: buildMeta(),
    });
  }
};

/**
 * Delete a flash sale
 */
export const deleteFlashSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Don't allow deleting active flash sales
    const existing = await db.query('SELECT status FROM flash_sales WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    if (existing.rows[0].status === 'active') {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_5000', message: 'Cannot delete an active flash sale. End it first.' },
        meta: buildMeta(),
      });
      return;
    }

    // Clean up Redis keys for this flash sale
    try {
      const redisClient = redis.getClient();
      const keys = await redis.keys(`flash:${id}:*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch {
      // Redis cleanup is best-effort
    }

    await db.query('DELETE FROM flash_sales WHERE id = $1', [id]);

    res.json({
      success: true,
      data: { message: 'Flash sale deleted successfully' },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error deleting flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to delete flash sale' },
      meta: buildMeta(),
    });
  }
};


/**
 * Update flash sale status with Redis stock preheating
 * Handles transitions: scheduled → active → ended, or scheduled → cancelled
 */
export const updateFlashSaleStatus = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'Status is required' },
        meta: buildMeta(),
      });
      return;
    }

    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM flash_sales WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    const currentStatus = existing.rows[0].status;

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      scheduled: ['active', 'cancelled'],
      pending: ['active', 'cancelled'],
      active: ['ended'],
      ended: [],
      cancelled: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(status)) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_5000',
          message: `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
        },
        meta: buildMeta(),
      });
      return;
    }

    // Update status in DB
    const result = await client.query(
      `UPDATE flash_sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // When activating: preheat stock to Redis
    if (status === 'active') {
      await preheatFlashSaleStock(id, client);
    }

    // When ending or cancelling: clean up Redis stock keys
    if (status === 'ended' || status === 'cancelled') {
      await cleanupFlashSaleRedisKeys(id);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: mapFlashSaleFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating flash sale status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to update flash sale status' },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Add a product to a flash sale
 */
export const addProductToFlashSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { productId, salePrice, stockLimit } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'productId is required' },
        meta: buildMeta(),
      });
      return;
    }

    // Check flash sale exists
    const flashSaleResult = await db.query('SELECT * FROM flash_sales WHERE id = $1', [id]);
    if (flashSaleResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    const flashSale = mapFlashSaleFromDb(flashSaleResult.rows[0]);

    // Check product exists
    const productResult = await db.query('SELECT price FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5005', message: 'Product not found' },
        meta: buildMeta(),
      });
      return;
    }

    const originalPrice = parseFloat(productResult.rows[0].price);
    let computedSalePrice = salePrice;

    // If no explicit salePrice, compute from discount
    if (computedSalePrice === undefined) {
      if (flashSale.discountType === 'percentage') {
        computedSalePrice = originalPrice * (1 - flashSale.discountValue / 100);
      } else if (flashSale.discountType === 'fixed') {
        computedSalePrice = Math.max(0, originalPrice - flashSale.discountValue);
      } else {
        computedSalePrice = originalPrice;
      }
    }

    computedSalePrice = Math.round(computedSalePrice * 100) / 100;

    const result = await db.query(
      `INSERT INTO flash_sale_products (
        flash_sale_id, product_id, original_price, sale_price, stock_limit
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (flash_sale_id, product_id)
      DO UPDATE SET sale_price = $4, stock_limit = $5
      RETURNING *`,
      [id, productId, originalPrice, computedSalePrice, stockLimit || null]
    );

    // If flash sale is active, update Redis stock
    if (flashSale.status === 'active' && stockLimit) {
      const soldCount = result.rows[0].sold_count || 0;
      const remaining = stockLimit - soldCount;
      try {
        await redis.set(FLASH_STOCK_KEY(id, productId), String(Math.max(0, remaining)));
      } catch {
        // Redis update is best-effort
      }
    }

    res.json({
      success: true,
      data: mapFlashSaleProductFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error adding product to flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to add product to flash sale' },
      meta: buildMeta(),
    });
  }
};

/**
 * Remove a product from a flash sale
 */
export const removeProductFromFlashSale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, productId } = req.params;

    const result = await db.query(
      'DELETE FROM flash_sale_products WHERE flash_sale_id = $1 AND product_id = $2 RETURNING id',
      [id, productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5005', message: 'Product not found in flash sale' },
        meta: buildMeta(),
      });
      return;
    }

    // Clean up Redis stock key
    try {
      await redis.del(FLASH_STOCK_KEY(id, productId));
    } catch {
      // Best-effort cleanup
    }

    res.json({
      success: true,
      data: { message: 'Product removed from flash sale' },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error removing product from flash sale:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to remove product from flash sale' },
      meta: buildMeta(),
    });
  }
};


/**
 * Deduct flash sale stock atomically using Redis Lua script
 * Returns { success, remainingStock } or error
 */
export const deductFlashSaleStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, productId } = req.params;
    const { userId, quantity = 1 } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'userId is required' },
        meta: buildMeta(),
      });
      return;
    }

    // Check flash sale is active
    const saleResult = await db.query(
      'SELECT status FROM flash_sales WHERE id = $1',
      [id]
    );
    if (saleResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ERR_5001', message: 'Flash sale not found' },
        meta: buildMeta(),
      });
      return;
    }

    const saleStatus = saleResult.rows[0].status;
    if (saleStatus !== 'active') {
      const errCode = saleStatus === 'scheduled' || saleStatus === 'pending' ? 'ERR_5002' : 'ERR_5003';
      const errMsg = saleStatus === 'scheduled' || saleStatus === 'pending'
        ? 'Flash sale has not started yet'
        : 'Flash sale has ended';
      res.status(400).json({
        success: false,
        error: { code: errCode, message: errMsg },
        meta: buildMeta(),
      });
      return;
    }

    // Check user purchase deduplication
    const userKey = FLASH_USER_KEY(id, userId, productId);
    const alreadyPurchased = await redis.get(userKey);
    if (alreadyPurchased) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_5000', message: 'You have already participated in this flash sale for this product' },
        meta: buildMeta(),
      });
      return;
    }

    // Atomic stock deduction via Lua script
    const stockKey = FLASH_STOCK_KEY(id, productId);
    const redisClient = redis.getClient();
    const result = await redisClient.eval(DEDUCT_STOCK_SCRIPT, {
      keys: [stockKey],
      arguments: [String(quantity)],
    });

    if (Number(result) === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_5004', message: 'Flash sale stock insufficient' },
        meta: buildMeta(),
      });
      return;
    }

    // Mark user as having purchased (TTL 24 hours)
    await redis.setex(userKey, 86400, '1');

    // Update sold_count in database (async, best-effort)
    db.query(
      `UPDATE flash_sale_products SET sold_count = sold_count + $1
       WHERE flash_sale_id = $2 AND product_id = $3`,
      [quantity, id, productId]
    ).catch((err) => console.error('Failed to update sold_count in DB:', err));

    // Get remaining stock
    const remaining = await redis.get(stockKey);

    res.json({
      success: true,
      data: {
        deducted: true,
        quantity,
        remainingStock: Number(remaining),
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error deducting flash sale stock:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to deduct flash sale stock' },
      meta: buildMeta(),
    });
  }
};

/**
 * Check if a user has already purchased a flash sale product
 */
export const checkUserPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, productId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_1001', message: 'userId query parameter is required' },
        meta: buildMeta(),
      });
      return;
    }

    const userKey = FLASH_USER_KEY(id, String(userId), productId);
    const purchased = await redis.get(userKey);

    res.json({
      success: true,
      data: {
        hasPurchased: !!purchased,
        flashSaleId: id,
        productId,
        userId,
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error checking user purchase:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERR_5000', message: 'Failed to check user purchase status' },
      meta: buildMeta(),
    });
  }
};

// ─── Redis Stock Helpers ────────────────────────────────────────────────────

/**
 * Preheat flash sale product stock into Redis.
 * Called when a flash sale transitions to 'active'.
 */
async function preheatFlashSaleStock(saleId: string, client?: any): Promise<void> {
  const queryFn = client || db;
  const productsResult = await queryFn.query(
    `SELECT product_id, stock_limit, sold_count
     FROM flash_sale_products
     WHERE flash_sale_id = $1`,
    [saleId]
  );

  for (const row of productsResult.rows) {
    const remaining = (row.stock_limit || 0) - (row.sold_count || 0);
    const key = FLASH_STOCK_KEY(saleId, row.product_id);
    await redis.set(key, String(Math.max(0, remaining)));
  }
}

/**
 * Clean up Redis keys for a flash sale (stock keys and user purchase keys).
 * Called when a flash sale ends or is cancelled.
 */
async function cleanupFlashSaleRedisKeys(saleId: string): Promise<void> {
  try {
    const keys = await redis.keys(`flash:${saleId}:*`);
    if (keys.length > 0) {
      const redisClient = redis.getClient();
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Error cleaning up Redis keys for flash sale:', err);
  }
}

// ─── DB Mapping Helpers ─────────────────────────────────────────────────────

function mapFlashSaleFromDb(row: any): FlashSale & { products?: FlashSaleProduct[] } {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    discountType: row.discount_type,
    discountValue: parseFloat(row.discount_value),
    maxQuantity: row.max_quantity,
    soldQuantity: row.sold_quantity || 0,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFlashSaleProductFromDb(row: any): FlashSaleProduct {
  return {
    id: row.id,
    flashSaleId: row.flash_sale_id,
    productId: row.product_id,
    originalPrice: parseFloat(row.original_price),
    salePrice: parseFloat(row.sale_price),
    stockLimit: row.stock_limit,
    soldCount: row.sold_count || 0,
    createdAt: row.created_at,
    product: row.product_name
      ? {
          id: row.product_id,
          name: row.product_name,
          sku: row.sku,
          imageUrl: row.image_url || undefined,
        }
      : undefined,
  };
}
