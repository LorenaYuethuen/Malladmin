import { Request, Response } from 'express';
import { db } from '../database/connection';
import redis from '../database/redis';
import type {
  Recommendation,
  CreateRecommendationRequest,
  UpdateRecommendationRequest,
} from '../types/marketing';

// Redis cache keys and TTL
const RECOMMENDATION_CACHE_KEY = (type: string) => `recommendation:list:${type}`;
const RECOMMENDATION_DETAIL_KEY = (id: string) => `recommendation:detail:${id}`;
const RECOMMENDATION_CACHE_TTL = 1800; // 30 minutes

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
 * Invalidate recommendation caches
 */
async function invalidateCache(id?: string) {
  try {
    // Invalidate list caches for all types
    const types = ['all', 'banner', 'featured', 'new_arrival', 'best_seller', 'hot_deal'];
    for (const type of types) {
      await redis.del(RECOMMENDATION_CACHE_KEY(type));
    }
    if (id) {
      await redis.del(RECOMMENDATION_DETAIL_KEY(id));
    }
  } catch {
    // Redis failure is non-critical
  }
}

/**
 * Get all recommendations with filters and pagination
 */
export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      position,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT * FROM recommendations WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM recommendations WHERE 1=1';
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

    if (position) {
      query += ` AND position = $${paramIndex}`;
      countQuery += ` AND position = $${paramIndex}`;
      params.push(position);
      countParams.push(position);
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
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1})`;
      countQuery += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    // Get total count
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Validate sort column
    const allowedSortColumns = ['priority', 'created_at', 'updated_at', 'title', 'click_count', 'type'];
    const safeSortBy = allowedSortColumns.includes(sortBy as string) ? sortBy : 'priority';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await db.query(query, params);
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        items: result.rows.map(mapRecommendationFromDb),
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
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch recommendations',
      },
      meta: buildMeta(),
    });
  }
};


/**
 * Get recommendation by ID with associated products
 */
export const getRecommendationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try Redis cache first
    try {
      const cached = await redis.get(RECOMMENDATION_DETAIL_KEY(id));
      if (cached) {
        res.json({
          success: true,
          data: JSON.parse(cached),
          meta: buildMeta(),
        });
        return;
      }
    } catch {
      // Redis failure is non-critical
    }

    const result = await db.query('SELECT * FROM recommendations WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Recommendation not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    const recommendation = mapRecommendationFromDb(result.rows[0]);

    // Get associated products
    const productsResult = await db.query(
      `SELECT rp.*, p.name, p.price, p.images, p.sku
       FROM recommendation_products rp
       JOIN products p ON rp.product_id = p.id
       WHERE rp.recommendation_id = $1
       ORDER BY rp.sort_order ASC`,
      [id]
    );

    recommendation.products = productsResult.rows.map((row: any) => ({
      id: row.id,
      recommendationId: row.recommendation_id,
      productId: row.product_id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      product: {
        id: row.product_id,
        name: row.name,
        price: parseFloat(row.price),
        imageUrl: row.images && row.images.length > 0 ? row.images[0] : null,
        sku: row.sku,
      },
    }));

    // Cache the result
    try {
      await redis.set(RECOMMENDATION_DETAIL_KEY(id), JSON.stringify(recommendation), { EX: RECOMMENDATION_CACHE_TTL });
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: recommendation,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch recommendation',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Create a new recommendation
 */
export const createRecommendation = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const data: CreateRecommendationRequest = req.body;

    // Validate required fields
    if (!data.title || !data.type || !data.position) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'title, type, and position are required',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Validate type
    const validTypes = ['banner', 'featured', 'new_arrival', 'best_seller', 'hot_deal'];
    if (!validTypes.includes(data.type)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          field: 'type',
        },
        meta: buildMeta(),
      });
      return;
    }

    const result = await client.query(
      `INSERT INTO recommendations (
        title, description, type, position, priority,
        link_url, image_url, start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.title,
        data.description || null,
        data.type,
        data.position,
        data.priority || 0,
        data.linkUrl || null,
        data.imageUrl || null,
        data.startDate || null,
        data.endDate || null,
      ]
    );

    const recommendation = mapRecommendationFromDb(result.rows[0]);

    // Add products if provided
    if (data.productIds && data.productIds.length > 0) {
      for (let i = 0; i < data.productIds.length; i++) {
        await client.query(
          `INSERT INTO recommendation_products (recommendation_id, product_id, sort_order)
           VALUES ($1, $2, $3)`,
          [recommendation.id, data.productIds[i], i]
        );
      }
    }

    await client.query('COMMIT');

    // Invalidate caches
    await invalidateCache();

    res.status(201).json({
      success: true,
      data: recommendation,
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to create recommendation',
      },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Update an existing recommendation
 */
export const updateRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateRecommendationRequest = req.body;

    // Check recommendation exists
    const existing = await db.query('SELECT * FROM recommendations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Recommendation not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Validate type if provided
    if (data.type) {
      const validTypes = ['banner', 'featured', 'new_arrival', 'best_seller', 'hot_deal'];
      if (!validTypes.includes(data.type)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ERR_1001',
            message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
            field: 'type',
          },
          meta: buildMeta(),
        });
        return;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(data.type);
    }
    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      params.push(data.position);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(data.priority);
    }
    if (data.linkUrl !== undefined) {
      updates.push(`link_url = $${paramIndex++}`);
      params.push(data.linkUrl);
    }
    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      params.push(data.imageUrl);
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
      `UPDATE recommendations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: mapRecommendationFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update recommendation',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Delete a recommendation
 */
export const deleteRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM recommendations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Recommendation not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: { id },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to delete recommendation',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Update sort order (priority) for a recommendation
 */
export const updateSortOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (priority === undefined || typeof priority !== 'number') {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'priority must be a number',
          field: 'priority',
        },
        meta: buildMeta(),
      });
      return;
    }

    const result = await db.query(
      'UPDATE recommendations SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [priority, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Recommendation not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: mapRecommendationFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error updating sort order:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update sort order',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Batch update sort orders for multiple recommendations
 */
export const batchUpdateSortOrder = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'items must be a non-empty array of { id, priority }',
        },
        meta: buildMeta(),
      });
      return;
    }

    await client.query('BEGIN');

    const updated: Recommendation[] = [];
    for (const item of items) {
      if (!item.id || item.priority === undefined) continue;
      const result = await client.query(
        'UPDATE recommendations SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [item.priority, item.id]
      );
      if (result.rows.length > 0) {
        updated.push(mapRecommendationFromDb(result.rows[0]));
      }
    }

    await client.query('COMMIT');

    // Invalidate caches
    await invalidateCache();

    res.json({
      success: true,
      data: updated,
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error batch updating sort order:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to batch update sort order',
      },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Add products to a recommendation
 */
export const addProducts = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'productIds must be a non-empty array',
          field: 'productIds',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Check recommendation exists
    const recResult = await client.query('SELECT id FROM recommendations WHERE id = $1', [id]);
    if (recResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Recommendation not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    await client.query('BEGIN');

    // Get current max sort_order
    const maxOrderResult = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM recommendation_products WHERE recommendation_id = $1',
      [id]
    );
    let nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;

    const added: any[] = [];
    for (const productId of productIds) {
      try {
        const result = await client.query(
          `INSERT INTO recommendation_products (recommendation_id, product_id, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (recommendation_id, product_id) DO NOTHING
           RETURNING *`,
          [id, productId, nextOrder++]
        );
        if (result.rows.length > 0) {
          added.push(result.rows[0]);
        }
      } catch {
        // Skip invalid product IDs (FK constraint)
      }
    }

    await client.query('COMMIT');

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: { added: added.length, items: added },
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding products to recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to add products to recommendation',
      },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Remove a product from a recommendation
 */
export const removeProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, productId } = req.params;

    const result = await db.query(
      'DELETE FROM recommendation_products WHERE recommendation_id = $1 AND product_id = $2 RETURNING id',
      [id, productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5009',
          message: 'Product not found in this recommendation',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: { removed: true },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error removing product from recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to remove product from recommendation',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Update product sort order within a recommendation
 */
export const updateProductSortOrder = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'items must be a non-empty array of { productId, sortOrder }',
        },
        meta: buildMeta(),
      });
      return;
    }

    await client.query('BEGIN');

    for (const item of items) {
      if (!item.productId || item.sortOrder === undefined) continue;
      await client.query(
        'UPDATE recommendation_products SET sort_order = $1 WHERE recommendation_id = $2 AND product_id = $3',
        [item.sortOrder, id, item.productId]
      );
    }

    await client.query('COMMIT');

    // Invalidate caches
    await invalidateCache(id);

    res.json({
      success: true,
      data: { updated: true },
      meta: buildMeta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product sort order:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update product sort order',
      },
      meta: buildMeta(),
    });
  } finally {
    client.release();
  }
};

/**
 * Get available recommendation types
 */
export const getRecommendationTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = [
      { value: 'banner', label: 'Banner', description: 'Homepage banner recommendations' },
      { value: 'featured', label: 'Featured', description: 'Featured product recommendations' },
      { value: 'new_arrival', label: 'New Arrival', description: 'New arrival product recommendations' },
      { value: 'best_seller', label: 'Best Seller', description: 'Best selling product recommendations' },
      { value: 'hot_deal', label: 'Hot Deal', description: 'Hot deal recommendations' },
    ];

    // Get count per type
    const countResult = await db.query(
      'SELECT type, COUNT(*) as count FROM recommendations GROUP BY type'
    );
    const countMap: Record<string, number> = {};
    for (const row of countResult.rows) {
      countMap[row.type] = parseInt(row.count);
    }

    const typesWithCount = types.map((t) => ({
      ...t,
      count: countMap[t.value] || 0,
    }));

    res.json({
      success: true,
      data: typesWithCount,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching recommendation types:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch recommendation types',
      },
      meta: buildMeta(),
    });
  }
};

// Helper: map DB row to Recommendation interface
function mapRecommendationFromDb(row: any): Recommendation {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    position: row.position,
    priority: row.priority,
    linkUrl: row.link_url,
    imageUrl: row.image_url,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    clickCount: row.click_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
