/**
 * Category Controller
 * Handles all category-related HTTP requests with CRUD operations
 * Supports hierarchical category structure with parent-child relationships
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../types';
import { Category } from '../types/product';
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
 * Generate slug from category name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build hierarchical category tree from flat list
 */
function buildCategoryTree(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const rootCategories: Category[] = [];

  // First pass: create map of all categories
  categories.forEach((category) => {
    categoryMap.set(category.id, { ...category, children: [] });
  });

  // Second pass: build tree structure
  categories.forEach((category) => {
    const cat = categoryMap.get(category.id)!;
    if (category.parentId) {
      const parent = categoryMap.get(category.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(cat);
      }
    } else {
      rootCategories.push(cat);
    }
  });

  return rootCategories;
}

/**
 * List categories with optional hierarchical structure
 * GET /api/v1/categories
 */
export const listCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { parentId, isActive, includeChildren, level, search } = req.query;

    // Build cache key
    const cacheKey = cacheService.category.getList(
      JSON.stringify({ parentId, isActive, includeChildren, level, search })
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

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        conditions.push('parent_id IS NULL');
      } else {
        paramCount++;
        conditions.push(`parent_id = $${paramCount}`);
        values.push(parentId);
      }
    }

    if (isActive !== undefined) {
      paramCount++;
      conditions.push(`is_active = $${paramCount}`);
      values.push(isActive === 'true');
    }

    if (level !== undefined) {
      paramCount++;
      conditions.push(`level = $${paramCount}`);
      values.push(parseInt(level as string));
    }

    if (search) {
      paramCount++;
      conditions.push(`(
        name ILIKE $${paramCount} OR 
        description ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get categories
    const query = `
      SELECT 
        id, name, slug, description,
        parent_id as "parentId", path, level, sort_order as "sortOrder",
        image_url as "imageUrl", icon, is_active as "isActive",
        meta_title as "metaTitle", meta_description as "metaDescription",
        meta_keywords as "metaKeywords",
        created_at as "createdAt", updated_at as "updatedAt",
        (SELECT COUNT(*) FROM products WHERE category_id = categories.id) as "productCount"
      FROM categories
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
    `;

    const result = await db.query(query, values);
    let categories = result.rows;

    // Build hierarchical tree if requested
    if (includeChildren === 'true' && !parentId) {
      categories = buildCategoryTree(categories);
    }

    // Cache the result
    await cacheService.set(cacheKey, categories, CacheTTL.CATEGORY_LIST);

    logger.info('Categories listed', {
      count: result.rows.length,
      filters: { parentId, isActive, includeChildren, level, search },
    });

    sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single category by ID
 * GET /api/v1/categories/:id
 */
export const getCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = cacheService.category.getDetail(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const query = `
      SELECT 
        c.id, c.name, c.slug, c.description,
        c.parent_id as "parentId", c.path, c.level, c.sort_order as "sortOrder",
        c.image_url as "imageUrl", c.icon, c.is_active as "isActive",
        c.meta_title as "metaTitle", c.meta_description as "metaDescription",
        c.meta_keywords as "metaKeywords",
        c.created_at as "createdAt", c.updated_at as "updatedAt",
        (SELECT COUNT(*) FROM products WHERE category_id = c.id) as "productCount",
        (
          SELECT json_build_object(
            'id', p.id,
            'name', p.name,
            'slug', p.slug
          )
          FROM categories p
          WHERE p.id = c.parent_id
        ) as parent,
        (
          SELECT json_agg(json_build_object(
            'id', ch.id,
            'name', ch.name,
            'slug', ch.slug,
            'level', ch.level,
            'sortOrder', ch.sort_order,
            'isActive', ch.is_active,
            'productCount', (SELECT COUNT(*) FROM products WHERE category_id = ch.id)
          ) ORDER BY ch.sort_order, ch.name)
          FROM categories ch
          WHERE ch.parent_id = c.id
        ) as children
      FROM categories c
      WHERE c.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Category', id);
    }

    const category = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, category, CacheTTL.CATEGORY_DETAIL);

    logger.info('Category retrieved', { categoryId: id });

    sendSuccess(res, category);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new category
 * POST /api/v1/categories
 */
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const data = req.body;

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check for duplicate slug
    const slugCheck = await client.query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      throw new ConflictError('Category with this slug already exists', { slug });
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const parentCheck = await client.query(
        'SELECT id, level FROM categories WHERE id = $1',
        [data.parentId]
      );
      if (parentCheck.rows.length === 0) {
        throw new NotFoundError('Parent category', data.parentId);
      }
      // Note: circular reference check is only needed for updates, not creates
      // A new category cannot create a circular reference since it has no children yet
    }

    await client.query('BEGIN');

    // Insert category (path and level are set by trigger)
    const categoryQuery = `
      INSERT INTO categories (
        name, slug, description, parent_id, sort_order,
        image_url, icon, is_active,
        meta_title, meta_description, meta_keywords,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING id, name, slug, parent_id as "parentId", path, level, 
                  sort_order as "sortOrder", is_active as "isActive",
                  created_at as "createdAt", updated_at as "updatedAt"
    `;

    const categoryValues = [
      data.name,
      slug,
      data.description || null,
      data.parentId || null,
      data.sortOrder || 0,
      data.imageUrl || null,
      data.icon || null,
      data.isActive !== false,
      data.metaTitle || null,
      data.metaDescription || null,
      data.metaKeywords || null,
      authReq.user?.id || null,
    ];

    const categoryResult = await client.query(categoryQuery, categoryValues);
    const category = categoryResult.rows[0];

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'category',
      aggregateId: category.id,
      eventType: 'CATEGORY_CREATED',
      payload: {
        categoryId: category.id,
        name: data.name,
        slug,
        parentId: data.parentId,
        createdBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.category.invalidateLists();

    logger.info('Category created', {
      categoryId: category.id,
      name: data.name,
      slug,
      createdBy: authReq.user?.id,
    });

    sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update category
 * PUT /api/v1/categories/:id
 */
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data = req.body;

    // Check if category exists
    const existingCategory = await client.query(
      'SELECT id, slug, parent_id FROM categories WHERE id = $1',
      [id]
    );

    if (existingCategory.rows.length === 0) {
      throw new NotFoundError('Category', id);
    }

    // Check for duplicate slug if changing
    if (data.slug && data.slug !== existingCategory.rows[0].slug) {
      const slugCheck = await client.query(
        'SELECT id FROM categories WHERE slug = $1 AND id != $2',
        [data.slug, id]
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('Category with this slug already exists', { slug: data.slug });
      }
    }

    // Validate parent category if changing
    if (data.parentId !== undefined && data.parentId !== existingCategory.rows[0].parent_id) {
      if (data.parentId) {
        // Check parent exists
        const parentCheck = await client.query(
          'SELECT id FROM categories WHERE id = $1',
          [data.parentId]
        );
        if (parentCheck.rows.length === 0) {
          throw new NotFoundError('Parent category', data.parentId);
        }

        // Prevent setting self as parent
        if (data.parentId === id) {
          throw new ValidationError('Category cannot be its own parent');
        }

        // Prevent circular reference (category cannot be moved under its own descendant)
        const circularCheck = await client.query(
          'SELECT id FROM categories WHERE path LIKE $1',
          [`%/${id}/%`]
        );
        const descendantIds = circularCheck.rows.map((row: any) => row.id);
        if (descendantIds.includes(data.parentId)) {
          throw new ValidationError('Cannot create circular category reference');
        }
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
      parentId: 'parent_id',
      sortOrder: 'sort_order',
      imageUrl: 'image_url',
      icon: 'icon',
      isActive: 'is_active',
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
        UPDATE categories
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, slug, parent_id as "parentId", path, level,
                  sort_order as "sortOrder", is_active as "isActive",
                  updated_at as "updatedAt"
      `;

      const result = await client.query(updateQuery, updateValues);
      const category = result.rows[0];

      // Write to outbox for event publishing
      await outboxService.writeEvent(client, {
        aggregateType: 'category',
        aggregateId: id,
        eventType: 'CATEGORY_UPDATED',
        payload: {
          categoryId: id,
          updatedFields: Object.keys(data),
          updatedBy: authReq.user?.id,
        },
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheService.category.invalidateDetail(id);
      await cacheService.category.invalidateLists();

      logger.info('Category updated', {
        categoryId: id,
        updatedFields: Object.keys(data),
        updatedBy: authReq.user?.id,
      });

      sendSuccess(res, category, 'Category updated successfully');
    } else {
      await client.query('ROLLBACK');
      sendSuccess(res, existingCategory.rows[0], 'No changes made');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Delete category
 * DELETE /api/v1/categories/:id
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    // Check if category exists
    const existingCategory = await client.query(
      'SELECT id, name FROM categories WHERE id = $1',
      [id]
    );

    if (existingCategory.rows.length === 0) {
      throw new NotFoundError('Category', id);
    }

    // Check if category has children
    const childrenCheck = await client.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
      [id]
    );

    if (parseInt(childrenCheck.rows[0].count) > 0) {
      throw new ValidationError('Cannot delete category with subcategories. Delete or move subcategories first.');
    }

    // Check if category has products
    const productsCheck = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      throw new ValidationError('Cannot delete category with products. Move or delete products first.');
    }

    await client.query('BEGIN');

    // Write to outbox before deletion
    await outboxService.writeEvent(client, {
      aggregateType: 'category',
      aggregateId: id,
      eventType: 'CATEGORY_DELETED',
      payload: {
        categoryId: id,
        name: existingCategory.rows[0].name,
        deletedBy: authReq.user?.id,
      },
    });

    // Delete category
    await client.query('DELETE FROM categories WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.category.invalidateDetail(id);
    await cacheService.category.invalidateLists();

    logger.info('Category deleted', {
      categoryId: id,
      deletedBy: authReq.user?.id,
    });

    sendSuccess(res, { id }, 'Category deleted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
