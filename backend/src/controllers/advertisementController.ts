import { Request, Response } from 'express';
import { db } from '../database/connection';
import redis from '../database/redis';
import type {
  Advertisement,
  CreateAdvertisementRequest,
  UpdateAdvertisementRequest,
} from '../types/marketing';

// Redis cache keys and TTL
const AD_LIST_CACHE_KEY = 'advertisements:list';
const AD_DETAIL_CACHE_KEY = (id: string) => `advertisements:${id}`;
const AD_CACHE_TTL = 300; // 5 minutes

// Max ads per position
const MAX_ADS_PER_POSITION: Record<string, number> = {
  top_banner: 5,
  sidebar: 10,
  popup: 3,
  footer: 5,
  category_banner: 8,
};

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
 * Invalidate advertisement list cache
 */
async function invalidateAdCache(id?: string): Promise<void> {
  try {
    const keys = await redis.keys('advertisements:list*');
    for (const key of keys) {
      await redis.del(key);
    }
    if (id) {
      await redis.del(AD_DETAIL_CACHE_KEY(id));
    }
  } catch {
    // Redis failure is non-critical
  }
}

/**
 * Get all advertisements with filters and pagination
 */
export const getAdvertisements = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      position,
      type,
      isActive,
      search,
      sortBy = 'priority',
      sortOrder = 'desc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Try Redis cache for unfiltered requests
    const cacheKey = `${AD_LIST_CACHE_KEY}:${JSON.stringify(req.query)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          ...JSON.parse(cached),
          meta: buildMeta(),
        });
        return;
      }
    } catch {
      // Redis failure is non-critical
    }

    let query = 'SELECT * FROM advertisements WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM advertisements WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;

    if (position) {
      query += ` AND position = $${paramIndex}`;
      countQuery += ` AND position = $${paramIndex}`;
      params.push(position);
      countParams.push(position);
      paramIndex++;
    }

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
    const allowedSortColumns = ['created_at', 'updated_at', 'priority', 'click_count', 'view_count', 'title', 'start_date', 'end_date'];
    const safeSortBy = allowedSortColumns.includes(sortBy as string) ? sortBy : 'priority';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await db.query(query, params);
    const totalPages = Math.ceil(total / Number(limit));

    const responseData = {
      data: {
        items: result.rows.map(mapAdvertisementFromDb),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
    };

    // Cache the result
    try {
      await redis.set(cacheKey, JSON.stringify(responseData), { EX: AD_CACHE_TTL });
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      ...responseData,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch advertisements',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Get advertisement by ID
 */
export const getAdvertisementById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try Redis cache
    try {
      const cached = await redis.get(AD_DETAIL_CACHE_KEY(id));
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

    const result = await db.query('SELECT * FROM advertisements WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5010',
          message: 'Advertisement not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    const ad = mapAdvertisementFromDb(result.rows[0]);

    // Cache the result
    try {
      await redis.set(AD_DETAIL_CACHE_KEY(id), JSON.stringify(ad), { EX: AD_CACHE_TTL });
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: ad,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching advertisement:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch advertisement',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Create new advertisement
 */
export const createAdvertisement = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateAdvertisementRequest = req.body;

    // Validate required fields
    if (!data.title || !data.imageUrl || !data.position || !data.startDate || !data.endDate) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_1001',
          message: 'title, imageUrl, position, startDate, and endDate are required',
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

    // Check position capacity
    const maxAds = MAX_ADS_PER_POSITION[data.position];
    if (maxAds) {
      const positionCount = await db.query(
        'SELECT COUNT(*) FROM advertisements WHERE position = $1 AND is_active = true',
        [data.position]
      );
      if (parseInt(positionCount.rows[0].count) >= maxAds) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ERR_5011',
            message: `Ad position "${data.position}" is full (max ${maxAds} active ads)`,
            field: 'position',
          },
          meta: buildMeta(),
        });
        return;
      }
    }

    const result = await db.query(
      `INSERT INTO advertisements (
        title, description, image_url, link_url, position,
        type, start_date, end_date, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.title,
        data.description || null,
        data.imageUrl,
        data.linkUrl || null,
        data.position,
        data.type || 'image',
        data.startDate,
        data.endDate,
        data.priority || 0,
      ]
    );

    await invalidateAdCache();

    res.status(201).json({
      success: true,
      data: mapAdvertisementFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error creating advertisement:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to create advertisement',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Update advertisement
 */
export const updateAdvertisement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateAdvertisementRequest = req.body;

    // Check advertisement exists
    const existing = await db.query('SELECT * FROM advertisements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5010',
          message: 'Advertisement not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // If changing position, check capacity
    if (data.position && data.position !== existing.rows[0].position) {
      const maxAds = MAX_ADS_PER_POSITION[data.position];
      if (maxAds) {
        const positionCount = await db.query(
          'SELECT COUNT(*) FROM advertisements WHERE position = $1 AND is_active = true AND id != $2',
          [data.position, id]
        );
        if (parseInt(positionCount.rows[0].count) >= maxAds) {
          res.status(400).json({
            success: false,
            error: {
              code: 'ERR_5011',
              message: `Ad position "${data.position}" is full (max ${maxAds} active ads)`,
              field: 'position',
            },
            meta: buildMeta(),
          });
          return;
        }
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
    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      params.push(data.imageUrl);
    }
    if (data.linkUrl !== undefined) {
      updates.push(`link_url = $${paramIndex++}`);
      params.push(data.linkUrl);
    }
    if (data.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      params.push(data.position);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(data.type);
    }
    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(data.endDate);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(data.priority);
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
      `UPDATE advertisements SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    await invalidateAdCache(id);

    res.json({
      success: true,
      data: mapAdvertisementFromDb(result.rows[0]),
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error updating advertisement:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to update advertisement',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Delete advertisement
 */
export const deleteAdvertisement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM advertisements WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5010',
          message: 'Advertisement not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    await invalidateAdCache(id);

    res.json({
      success: true,
      data: { id },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error deleting advertisement:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to delete advertisement',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Increment advertisement click count
 * POST /advertisements/:id/click
 */
export const incrementAdClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE advertisements SET click_count = click_count + 1 WHERE id = $1 RETURNING id, click_count',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5010',
          message: 'Advertisement not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    // Invalidate detail cache since click_count changed
    try {
      await redis.del(AD_DETAIL_CACHE_KEY(id));
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        clickCount: result.rows[0].click_count,
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error incrementing click count:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to increment click count',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Increment advertisement view count
 * POST /advertisements/:id/view
 */
export const incrementAdView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE advertisements SET view_count = view_count + 1 WHERE id = $1 RETURNING id, view_count',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ERR_5010',
          message: 'Advertisement not found',
        },
        meta: buildMeta(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        viewCount: result.rows[0].view_count,
      },
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to increment view count',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Get advertisements by position
 * GET /advertisements/position/:position
 */
export const getAdvertisementsByPosition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { position } = req.params;

    // Try Redis cache
    const cacheKey = `advertisements:position:${position}`;
    try {
      const cached = await redis.get(cacheKey);
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

    const result = await db.query(
      `SELECT * FROM advertisements
       WHERE position = $1 AND is_active = true
         AND start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP
       ORDER BY priority DESC, created_at DESC`,
      [position]
    );

    const ads = result.rows.map(mapAdvertisementFromDb);

    // Cache the result
    try {
      await redis.set(cacheKey, JSON.stringify(ads), { EX: AD_CACHE_TTL });
    } catch {
      // Redis failure is non-critical
    }

    res.json({
      success: true,
      data: ads,
      meta: buildMeta(),
    });
  } catch (error) {
    console.error('Error fetching advertisements by position:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERR_5000',
        message: 'Failed to fetch advertisements by position',
      },
      meta: buildMeta(),
    });
  }
};

/**
 * Map database row to Advertisement type
 */
function mapAdvertisementFromDb(row: any): Advertisement {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    position: row.position,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    priority: row.priority,
    isActive: row.is_active,
    clickCount: row.click_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
