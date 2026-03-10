/**
 * Attribute Controller
 * Handles all attribute-related HTTP requests with CRUD operations
 * Supports product attribute associations and filtering
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../types';
import {
  CreateAttributeRequest,
  UpdateAttributeRequest,
  AttributeListQuery,
} from '../validation/attributeSchemas';
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
 * Generate slug from attribute name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * List attributes with filtering, sorting, and pagination
 * GET /api/v1/attributes
 */
export const listAttributes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as AttributeListQuery;

    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = query?.sortBy || 'sort_order';
    const sortOrder = query?.sortOrder || 'asc';

    // Build cache key
    const cacheKey = cacheService.attribute.getList(
      page,
      limit,
      JSON.stringify({ type: query?.type, isFilterable: query?.isFilterable, isVisible: query?.isVisible, search: query?.search, sortBy, sortOrder })
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

    if (query?.type) {
      paramCount++;
      conditions.push(`a.type = $${paramCount}`);
      values.push(query.type);
    }

    if (query?.isFilterable !== undefined) {
      paramCount++;
      conditions.push(`a.is_filterable = $${paramCount}`);
      values.push(query.isFilterable === 'true');
    }

    if (query?.isVisible !== undefined) {
      paramCount++;
      conditions.push(`a.is_visible = $${paramCount}`);
      values.push(query.isVisible === 'true');
    }

    if (query?.search) {
      paramCount++;
      conditions.push(`(
        a.name ILIKE $${paramCount} OR 
        a.description ILIKE $${paramCount}
      )`);
      values.push(`%${query.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attributes a
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Determine sort column
    let sortColumn = 'a.sort_order';
    if (sortBy === 'name') {
      sortColumn = 'a.name';
    } else if (sortBy === 'created_at') {
      sortColumn = 'a.created_at';
    } else if (sortBy === 'type') {
      sortColumn = 'a.type';
    }

    // Get attributes with product usage count
    const attributesQuery = `
      SELECT 
        a.id, a.name, a.slug, a.type, a.options,
        a.is_required as "isRequired", a.is_filterable as "isFilterable",
        a.is_visible as "isVisible", a.sort_order as "sortOrder",
        a.description,
        a.created_at as "createdAt", a.updated_at as "updatedAt",
        (SELECT COUNT(*) FROM product_attributes WHERE attribute_id = a.id) as "productCount"
      FROM attributes a
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const attributesResult = await db.query(attributesQuery, [...values, limit, offset]);

    const response = {
      items: attributesResult.rows,
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
    await cacheService.set(cacheKey, response, CacheTTL.ATTRIBUTE_LIST);

    logger.info('Attributes listed', {
      page,
      limit,
      total,
      filters: { type: query?.type, isFilterable: query?.isFilterable, isVisible: query?.isVisible, search: query?.search },
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single attribute by ID
 * GET /api/v1/attributes/:id
 */
export const getAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = cacheService.attribute.getDetail(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const query = `
      SELECT 
        a.id, a.name, a.slug, a.type, a.options,
        a.is_required as "isRequired", a.is_filterable as "isFilterable",
        a.is_visible as "isVisible", a.sort_order as "sortOrder",
        a.description,
        a.created_at as "createdAt", a.updated_at as "updatedAt",
        (SELECT COUNT(*) FROM product_attributes WHERE attribute_id = a.id) as "productCount",
        (
          SELECT json_agg(json_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug,
            'value', pa.value,
            'imageUrl', (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1)
          ) ORDER BY p.name)
          FROM product_attributes pa
          JOIN products p ON pa.product_id = p.id
          WHERE pa.attribute_id = a.id
          LIMIT 10
        ) as "recentProducts"
      FROM attributes a
      WHERE a.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Attribute', id);
    }

    const attribute = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, attribute, CacheTTL.ATTRIBUTE_DETAIL);

    logger.info('Attribute retrieved', { attributeId: id });

    sendSuccess(res, attribute);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new attribute
 * POST /api/v1/attributes
 */
export const createAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const data: CreateAttributeRequest = req.body;

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check for duplicate name
    const nameCheck = await client.query(
      'SELECT id FROM attributes WHERE name = $1',
      [data.name]
    );
    if (nameCheck.rows.length > 0) {
      throw new ConflictError('Attribute with this name already exists', { name: data.name });
    }

    // Check for duplicate slug
    const slugCheck = await client.query(
      'SELECT id FROM attributes WHERE slug = $1',
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      throw new ConflictError('Attribute with this slug already exists', { slug });
    }

    await client.query('BEGIN');

    // Insert attribute
    const attributeQuery = `
      INSERT INTO attributes (
        name, slug, type, options,
        is_required, is_filterable, is_visible, sort_order,
        description
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id, name, slug, type, options,
                  is_required as "isRequired", is_filterable as "isFilterable",
                  is_visible as "isVisible", sort_order as "sortOrder",
                  description,
                  created_at as "createdAt", updated_at as "updatedAt"
    `;

    const attributeValues = [
      data.name,
      slug,
      data.type,
      data.options ? JSON.stringify(data.options) : null,
      data.isRequired || false,
      data.isFilterable !== false,
      data.isVisible !== false,
      data.sortOrder || 0,
      data.description || null,
    ];

    const attributeResult = await client.query(attributeQuery, attributeValues);
    const attribute = attributeResult.rows[0];

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'attribute',
      aggregateId: attribute.id,
      eventType: 'ATTRIBUTE_CREATED',
      payload: {
        attributeId: attribute.id,
        name: data.name,
        slug,
        type: data.type,
        createdBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.attribute.invalidateLists();

    logger.info('Attribute created', {
      attributeId: attribute.id,
      name: data.name,
      slug,
      type: data.type,
      createdBy: authReq.user?.id,
    });

    sendSuccess(res, attribute, 'Attribute created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update attribute
 * PUT /api/v1/attributes/:id
 */
export const updateAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data: UpdateAttributeRequest = req.body;

    // Check if attribute exists
    const existingAttribute = await client.query(
      'SELECT id, name, slug, type FROM attributes WHERE id = $1',
      [id]
    );

    if (existingAttribute.rows.length === 0) {
      throw new NotFoundError('Attribute', id);
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== existingAttribute.rows[0].name) {
      const nameCheck = await client.query(
        'SELECT id FROM attributes WHERE name = $1 AND id != $2',
        [data.name, id]
      );
      if (nameCheck.rows.length > 0) {
        throw new ConflictError('Attribute with this name already exists', { name: data.name });
      }
    }

    // Check for duplicate slug if changing
    if (data.slug && data.slug !== existingAttribute.rows[0].slug) {
      const slugCheck = await client.query(
        'SELECT id FROM attributes WHERE slug = $1 AND id != $2',
        [data.slug, id]
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('Attribute with this slug already exists', { slug: data.slug });
      }
    }

    // Validate type change
    if (data.type && data.type !== existingAttribute.rows[0].type) {
      // Check if attribute is used by products
      const usageCheck = await client.query(
        'SELECT COUNT(*) as count FROM product_attributes WHERE attribute_id = $1',
        [id]
      );
      if (parseInt(usageCheck.rows[0].count) > 0) {
        throw new ValidationError('Cannot change attribute type when it is used by products');
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
      type: 'type',
      options: 'options',
      isRequired: 'is_required',
      isFilterable: 'is_filterable',
      isVisible: 'is_visible',
      sortOrder: 'sort_order',
      description: 'description',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in data) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        if (key === 'options') {
          updateValues.push((data as any)[key] ? JSON.stringify((data as any)[key]) : null);
        } else {
          updateValues.push((data as any)[key]);
        }
      }
    }

    if (updateFields.length > 0) {
      paramCount++;
      updateValues.push(id);

      const updateQuery = `
        UPDATE attributes
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, slug, type, options,
                  is_required as "isRequired", is_filterable as "isFilterable",
                  is_visible as "isVisible", sort_order as "sortOrder",
                  description,
                  updated_at as "updatedAt"
      `;

      const result = await client.query(updateQuery, updateValues);
      const attribute = result.rows[0];

      // Write to outbox for event publishing
      await outboxService.writeEvent(client, {
        aggregateType: 'attribute',
        aggregateId: id,
        eventType: 'ATTRIBUTE_UPDATED',
        payload: {
          attributeId: id,
          updatedFields: Object.keys(data),
          updatedBy: authReq.user?.id,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.attribute.invalidateDetail(id);
      await cacheService.attribute.invalidateLists();

      logger.info('Attribute updated', {
        attributeId: id,
        updatedFields: Object.keys(data),
        updatedBy: authReq.user?.id,
      });

      sendSuccess(res, attribute, 'Attribute updated successfully');
    } else {
      await client.query('ROLLBACK');
      sendSuccess(res, existingAttribute.rows[0], 'No changes made');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Delete attribute
 * DELETE /api/v1/attributes/:id
 */
export const deleteAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    // Check if attribute exists
    const existingAttribute = await client.query(
      'SELECT id, name FROM attributes WHERE id = $1',
      [id]
    );

    if (existingAttribute.rows.length === 0) {
      throw new NotFoundError('Attribute', id);
    }

    // Check if attribute is used by products
    const productsCheck = await client.query(
      'SELECT COUNT(*) as count FROM product_attributes WHERE attribute_id = $1',
      [id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      throw new ValidationError('Cannot delete attribute that is used by products. Remove from products first.');
    }

    await client.query('BEGIN');

    // Write to outbox before deletion
    await outboxService.writeEvent(client, {
      aggregateType: 'attribute',
      aggregateId: id,
      eventType: 'ATTRIBUTE_DELETED',
      payload: {
        attributeId: id,
        name: existingAttribute.rows[0].name,
        deletedBy: authReq.user?.id,
      },
    });

    // Delete attribute
    await client.query('DELETE FROM attributes WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.attribute.invalidateDetail(id);
    await cacheService.attribute.invalidateLists();

    logger.info('Attribute deleted', {
      attributeId: id,
      deletedBy: authReq.user?.id,
    });

    sendSuccess(res, { id }, 'Attribute deleted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get attributes by product ID
 * GET /api/v1/attributes/by-product/:productId
 */
export const getAttributesByProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    // Try cache first
    const cacheKey = `attribute:product:${productId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    // Check if product exists
    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      throw new NotFoundError('Product', productId);
    }

    const query = `
      SELECT 
        a.id, a.name, a.slug, a.type, a.options,
        a.is_required as "isRequired", a.is_filterable as "isFilterable",
        a.is_visible as "isVisible", a.sort_order as "sortOrder",
        a.description,
        pa.value,
        pa.id as "productAttributeId"
      FROM attributes a
      JOIN product_attributes pa ON a.id = pa.attribute_id
      WHERE pa.product_id = $1
      ORDER BY a.sort_order ASC, a.name ASC
    `;

    const result = await db.query(query, [productId]);

    // Cache the result
    await cacheService.set(cacheKey, result.rows, CacheTTL.ATTRIBUTE_DETAIL);

    logger.info('Product attributes retrieved', { productId, count: result.rows.length });

    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
};

