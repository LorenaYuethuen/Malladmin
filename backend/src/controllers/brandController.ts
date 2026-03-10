/**
 * Brand Controller
 * Handles all brand-related HTTP requests with CRUD operations
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../types';
import {
  CreateBrandRequest,
  UpdateBrandRequest,
  BrandListQuery,
} from '../validation/brandSchemas';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { cacheService, CacheTTL } from '../services/cacheService';
import { outboxService } from '../services/outboxService';
import logger from '../utils/logger';

/**
 * Generate slug from brand name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * List brands with filtering, sorting, and pagination
 * GET /api/v1/brands
 */
export const listBrands = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as BrandListQuery;

    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = query?.sortBy || 'name';
    const sortOrder = query?.sortOrder || 'asc';

    // Build cache key
    const cacheKey = cacheService.brand.getList(
      page,
      limit,
      JSON.stringify({ isActive: query?.isActive, search: query?.search, sortBy, sortOrder })
    );

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (query?.isActive !== undefined) {
      paramCount++;
      conditions.push(`b.is_active = $${paramCount}`);
      values.push(query.isActive === 'true');
    }

    if (query?.search) {
      paramCount++;
      conditions.push(`(
        b.name ILIKE $${paramCount} OR 
        b.description ILIKE $${paramCount}
      )`);
      values.push(`%${query.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM brands b
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Determine sort column
    let sortColumn = 'b.name';
    if (sortBy === 'created_at') {
      sortColumn = 'b.created_at';
    } else if (sortBy === 'sort_order') {
      sortColumn = 'b.sort_order';
    } else if (sortBy === 'product_count') {
      sortColumn = 'product_count';
    }

    // Get brands with product count
    const brandsQuery = `
      SELECT 
        b.id, b.name, b.slug, b.description,
        b.logo_url as "logoUrl", b.website_url as "websiteUrl",
        b.is_active as "isActive", b.sort_order as "sortOrder",
        b.meta_title as "metaTitle", b.meta_description as "metaDescription",
        b.meta_keywords as "metaKeywords",
        b.created_at as "createdAt", b.updated_at as "updatedAt",
        (SELECT COUNT(*) FROM products WHERE brand_id = b.id) as "productCount"
      FROM brands b
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const brandsResult = await db.query(brandsQuery, [...values, limit, offset]);

    const response = {
      items: brandsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };

    // Cache the result
    await cacheService.set(cacheKey, response, CacheTTL.BRAND_LIST);

    logger.info('Brands listed', {
      page,
      limit,
      total,
      filters: { isActive: query?.isActive, search: query?.search },
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single brand by ID
 * GET /api/v1/brands/:id
 */
export const getBrand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = cacheService.brand.getDetail(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const query = `
      SELECT 
        b.id, b.name, b.slug, b.description,
        b.logo_url as "logoUrl", b.website_url as "websiteUrl",
        b.is_active as "isActive", b.sort_order as "sortOrder",
        b.meta_title as "metaTitle", b.meta_description as "metaDescription",
        b.meta_keywords as "metaKeywords",
        b.created_at as "createdAt", b.updated_at as "updatedAt",
        (SELECT COUNT(*) FROM products WHERE brand_id = b.id) as "productCount",
        (
          SELECT json_agg(json_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug,
            'price', p.price,
            'salePrice', p.sale_price,
            'status', p.status,
            'imageUrl', (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1)
          ) ORDER BY p.created_at DESC)
          FROM products p
          WHERE p.brand_id = b.id
          LIMIT 10
        ) as "recentProducts"
      FROM brands b
      WHERE b.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Brand', id);
    }

    const brand = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, brand, CacheTTL.BRAND_DETAIL);

    logger.info('Brand retrieved', { brandId: id });

    sendSuccess(res, brand);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new brand
 * POST /api/v1/brands
 */
export const createBrand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const data: CreateBrandRequest = req.body;

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check for duplicate name
    const nameCheck = await client.query(
      'SELECT id FROM brands WHERE name = $1',
      [data.name]
    );
    if (nameCheck.rows.length > 0) {
      throw new ConflictError('Brand with this name already exists', { name: data.name });
    }

    // Check for duplicate slug
    const slugCheck = await client.query(
      'SELECT id FROM brands WHERE slug = $1',
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      throw new ConflictError('Brand with this slug already exists', { slug });
    }

    await client.query('BEGIN');

    // Insert brand
    const brandQuery = `
      INSERT INTO brands (
        name, slug, description, logo_url, website_url,
        is_active, sort_order,
        meta_title, meta_description, meta_keywords,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id, name, slug, description,
                  logo_url as "logoUrl", website_url as "websiteUrl",
                  is_active as "isActive", sort_order as "sortOrder",
                  meta_title as "metaTitle", meta_description as "metaDescription",
                  meta_keywords as "metaKeywords",
                  created_at as "createdAt", updated_at as "updatedAt"
    `;

    const brandValues = [
      data.name,
      slug,
      data.description || null,
      data.logoUrl || null,
      data.websiteUrl || null,
      data.isActive !== false,
      data.sortOrder || 0,
      data.metaTitle || null,
      data.metaDescription || null,
      data.metaKeywords || null,
      authReq.user?.id || null,
    ];

    const brandResult = await client.query(brandQuery, brandValues);
    const brand = brandResult.rows[0];

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'brand',
      aggregateId: brand.id,
      eventType: 'BRAND_CREATED',
      payload: {
        brandId: brand.id,
        name: data.name,
        slug,
        createdBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.brand.invalidateLists();

    logger.info('Brand created', {
      brandId: brand.id,
      name: data.name,
      slug,
      createdBy: authReq.user?.id,
    });

    sendSuccess(res, brand, 'Brand created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update brand
 * PUT /api/v1/brands/:id
 */
export const updateBrand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data: UpdateBrandRequest = req.body;

    // Check if brand exists
    const existingBrand = await client.query(
      'SELECT id, name, slug FROM brands WHERE id = $1',
      [id]
    );

    if (existingBrand.rows.length === 0) {
      throw new NotFoundError('Brand', id);
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== existingBrand.rows[0].name) {
      const nameCheck = await client.query(
        'SELECT id FROM brands WHERE name = $1 AND id != $2',
        [data.name, id]
      );
      if (nameCheck.rows.length > 0) {
        throw new ConflictError('Brand with this name already exists', { name: data.name });
      }
    }

    // Check for duplicate slug if changing
    if (data.slug && data.slug !== existingBrand.rows[0].slug) {
      const slugCheck = await client.query(
        'SELECT id FROM brands WHERE slug = $1 AND id != $2',
        [data.slug, id]
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('Brand with this slug already exists', { slug: data.slug });
      }
    }

    await client.query('BEGIN');

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 0;

    const fieldMap: Record<string, string> = {
      name: 'name',
      slug: 'slug',
      description: 'description',
      logoUrl: 'logo_url',
      websiteUrl: 'website_url',
      isActive: 'is_active',
      sortOrder: 'sort_order',
      metaTitle: 'meta_title',
      metaDescription: 'meta_description',
      metaKeywords: 'meta_keywords',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in data) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        updateValues.push((data as any)[key]);
      }
    }

    if (updateFields.length > 0) {
      paramCount++;
      updateFields.push(`updated_by = $${paramCount}`);
      updateValues.push(authReq.user?.id || null);

      paramCount++;
      updateValues.push(id);

      const updateQuery = `
        UPDATE brands
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, slug, description,
                  logo_url as "logoUrl", website_url as "websiteUrl",
                  is_active as "isActive", sort_order as "sortOrder",
                  meta_title as "metaTitle", meta_description as "metaDescription",
                  meta_keywords as "metaKeywords",
                  updated_at as "updatedAt"
      `;

      const result = await client.query(updateQuery, updateValues);
      const brand = result.rows[0];

      // Write to outbox for event publishing
      await outboxService.writeEvent(client, {
        aggregateType: 'brand',
        aggregateId: id,
        eventType: 'BRAND_UPDATED',
        payload: {
          brandId: id,
          updatedFields: Object.keys(data),
          updatedBy: authReq.user?.id,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.brand.invalidateDetail(id);
      await cacheService.brand.invalidateLists();

      logger.info('Brand updated', {
        brandId: id,
        updatedFields: Object.keys(data),
        updatedBy: authReq.user?.id,
      });

      sendSuccess(res, brand, 'Brand updated successfully');
    } else {
      await client.query('ROLLBACK');
      sendSuccess(res, existingBrand.rows[0], 'No changes made');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Delete brand
 * DELETE /api/v1/brands/:id
 */
export const deleteBrand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    // Check if brand exists
    const existingBrand = await client.query(
      'SELECT id, name FROM brands WHERE id = $1',
      [id]
    );

    if (existingBrand.rows.length === 0) {
      throw new NotFoundError('Brand', id);
    }

    // Check if brand has products
    const productsCheck = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE brand_id = $1',
      [id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      throw new ValidationError('Cannot delete brand with products. Remove or reassign products first.');
    }

    await client.query('BEGIN');

    // Write to outbox before deletion
    await outboxService.writeEvent(client, {
      aggregateType: 'brand',
      aggregateId: id,
      eventType: 'BRAND_DELETED',
      payload: {
        brandId: id,
        name: existingBrand.rows[0].name,
        deletedBy: authReq.user?.id,
      },
    });

    // Delete brand
    await client.query('DELETE FROM brands WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.brand.invalidateDetail(id);
    await cacheService.brand.invalidateLists();

    logger.info('Brand deleted', {
      brandId: id,
      deletedBy: authReq.user?.id,
    });

    sendSuccess(res, { id }, 'Brand deleted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Upload brand logo
 * POST /api/v1/brands/:id/logo
 */
export const uploadLogo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const file = (req as any).file;

    if (!file) {
      throw new ValidationError('No logo file provided');
    }

    // Check if brand exists
    const brandCheck = await client.query(
      'SELECT id FROM brands WHERE id = $1',
      [id]
    );

    if (brandCheck.rows.length === 0) {
      throw new NotFoundError('Brand', id);
    }

    // In a real implementation, upload to S3 or CDN
    // For now, we'll use the local file path
    const logoUrl = `/uploads/brands/${file.filename}`;

    await client.query('BEGIN');

    // Update brand with logo URL
    const updateQuery = `
      UPDATE brands
      SET logo_url = $1, updated_by = $2
      WHERE id = $3
      RETURNING id, name, logo_url as "logoUrl", updated_at as "updatedAt"
    `;

    const result = await client.query(updateQuery, [
      logoUrl,
      authReq.user?.id || null,
      id,
    ]);

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'brand',
      aggregateId: id,
      eventType: 'BRAND_UPDATED',
      payload: {
        brandId: id,
        logoUrl,
        updatedBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.brand.invalidateDetail(id);
    await cacheService.brand.invalidateLists();

    logger.info('Brand logo uploaded', {
      brandId: id,
      logoUrl,
      updatedBy: authReq.user?.id,
    });

    sendSuccess(res, result.rows[0], 'Brand logo uploaded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
