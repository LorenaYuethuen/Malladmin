/**
 * Product Controller
 * Handles all product-related HTTP requests with CRUD operations
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { AuthRequest } from '../types';
import {
  CreateProductRequest,
  ProductListQuery,
  BulkUpdateStatusRequest,
  BulkUpdateCategoryRequest,
} from '../types/product';
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
 * Generate slug from product name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * List products with filtering, sorting, and pagination
 * GET /api/v1/products
 */
export const listProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as ProductListQuery;

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';

    // Build cache key
    const cacheKey = cacheService.product.getList(
      page,
      limit,
      JSON.stringify(query.filters || {})
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

    if (query.filters) {
      const { filters } = query;

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          paramCount++;
          conditions.push(`p.status = ANY($${paramCount})`);
          values.push(filters.status);
        } else {
          paramCount++;
          conditions.push(`p.status = $${paramCount}`);
          values.push(filters.status);
        }
      }

      if (filters.visibility) {
        paramCount++;
        conditions.push(`p.visibility = $${paramCount}`);
        values.push(filters.visibility);
      }

      if (filters.categoryId) {
        paramCount++;
        conditions.push(`p.category_id = $${paramCount}`);
        values.push(filters.categoryId);
      }

      if (filters.brandId) {
        paramCount++;
        conditions.push(`p.brand_id = $${paramCount}`);
        values.push(filters.brandId);
      }

      if (filters.minPrice !== undefined) {
        paramCount++;
        conditions.push(`p.price >= $${paramCount}`);
        values.push(filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        paramCount++;
        conditions.push(`p.price <= $${paramCount}`);
        values.push(filters.maxPrice);
      }

      if (filters.isFeatured !== undefined) {
        paramCount++;
        conditions.push(`p.is_featured = $${paramCount}`);
        values.push(filters.isFeatured);
      }

      if (filters.isNew !== undefined) {
        paramCount++;
        conditions.push(`p.is_new = $${paramCount}`);
        values.push(filters.isNew);
      }

      if (filters.isOnSale !== undefined) {
        paramCount++;
        conditions.push(`p.is_on_sale = $${paramCount}`);
        values.push(filters.isOnSale);
      }

      if (filters.inStock !== undefined) {
        if (filters.inStock) {
          conditions.push(`pi.is_in_stock = TRUE`);
        } else {
          conditions.push(`pi.is_in_stock = FALSE`);
        }
      }

      if (filters.search) {
        paramCount++;
        conditions.push(`(
          to_tsvector('english', p.name || ' ' || COALESCE(p.description, '') || ' ' || p.sku) 
          @@ plainto_tsquery('english', $${paramCount})
        )`);
        values.push(filters.search);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get products
    const productsQuery = `
      SELECT 
        p.id, p.name, p.slug, p.sku, p.barcode,
        p.description, p.short_description as "shortDescription",
        p.price, p.sale_price as "salePrice", p.cost_price as "costPrice",
        p.category_id as "categoryId", p.brand_id as "brandId",
        p.status, p.visibility, p.product_type as "productType",
        p.weight, p.length, p.width, p.height,
        p.is_featured as "isFeatured", p.is_new as "isNew", 
        p.is_on_sale as "isOnSale", p.allow_backorder as "allowBackorder",
        p.track_inventory as "trackInventory",
        p.rating_average as "ratingAverage", p.rating_count as "ratingCount",
        p.review_count as "reviewCount", p.view_count as "viewCount",
        p.sales_count as "salesCount",
        p.published_at as "publishedAt", p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        c.name as "categoryName", b.name as "brandName",
        pi.quantity, pi.available_quantity as "availableQuantity",
        pi.is_in_stock as "isInStock", pi.is_low_stock as "isLowStock",
        (
          SELECT json_agg(json_build_object(
            'id', img.id,
            'url', img.url,
            'altText', img.alt_text,
            'isPrimary', img.is_primary,
            'sortOrder', img.sort_order
          ) ORDER BY img.sort_order, img.is_primary DESC)
          FROM product_images img
          WHERE img.product_id = p.id
        ) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const productsResult = await db.query(productsQuery, [...values, limit, offset]);

    const response = {
      items: productsResult.rows,
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
    await cacheService.set(cacheKey, response, CacheTTL.PRODUCT_LIST);

    logger.info('Products listed', {
      page,
      limit,
      total,
      filters: query.filters,
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};


/**
 * Get single product by ID
 * GET /api/v1/products/:id
 */
export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = cacheService.product.getDetail(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const query = `
      SELECT 
        p.id, p.name, p.slug, p.sku, p.barcode,
        p.description, p.short_description as "shortDescription",
        p.price, p.sale_price as "salePrice", p.cost_price as "costPrice",
        p.category_id as "categoryId", p.brand_id as "brandId",
        p.status, p.visibility, p.product_type as "productType",
        p.weight, p.length, p.width, p.height,
        p.is_featured as "isFeatured", p.is_new as "isNew", 
        p.is_on_sale as "isOnSale", p.allow_backorder as "allowBackorder",
        p.track_inventory as "trackInventory",
        p.rating_average as "ratingAverage", p.rating_count as "ratingCount",
        p.review_count as "reviewCount", p.view_count as "viewCount",
        p.sales_count as "salesCount",
        p.published_at as "publishedAt", p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug
        ) as category,
        json_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
          'logoUrl', b.logo_url
        ) as brand,
        (
          SELECT json_agg(json_build_object(
            'id', img.id,
            'url', img.url,
            'altText', img.alt_text,
            'title', img.title,
            'isPrimary', img.is_primary,
            'sortOrder', img.sort_order,
            'width', img.width,
            'height', img.height
          ) ORDER BY img.sort_order, img.is_primary DESC)
          FROM product_images img
          WHERE img.product_id = p.id
        ) as images,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'attributeId', pa.attribute_id,
            'value', pa.value,
            'attribute', json_build_object(
              'id', a.id,
              'name', a.name,
              'slug', a.slug,
              'type', a.type
            )
          ))
          FROM product_attributes pa
          JOIN attributes a ON pa.attribute_id = a.id
          WHERE pa.product_id = p.id
        ) as attributes,
        json_build_object(
          'id', pi.id,
          'quantity', pi.quantity,
          'reservedQuantity', pi.reserved_quantity,
          'availableQuantity', pi.available_quantity,
          'lowStockThreshold', pi.low_stock_threshold,
          'isInStock', pi.is_in_stock,
          'isLowStock', pi.is_low_stock,
          'lastRestockedAt', pi.last_restocked_at,
          'updatedAt', pi.updated_at
        ) as inventory,
        json_build_object(
          'id', ps.id,
          'metaTitle', ps.meta_title,
          'metaDescription', ps.meta_description,
          'metaKeywords', ps.meta_keywords,
          'ogTitle', ps.og_title,
          'ogDescription', ps.og_description,
          'ogImageUrl', ps.og_image_url,
          'canonicalUrl', ps.canonical_url,
          'robots', ps.robots
        ) as seo
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      LEFT JOIN product_seo ps ON p.id = ps.product_id
      WHERE p.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Product', id);
    }

    const product = result.rows[0];

    // Cache the result
    await cacheService.set(cacheKey, product, CacheTTL.PRODUCT_DETAIL);

    // Increment view count asynchronously
    db.query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [id]).catch(
      (error) => logger.error('Failed to increment view count', { error, productId: id })
    );

    logger.info('Product retrieved', { productId: id });

    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
};


/**
 * Create new product
 * POST /api/v1/products
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const data: CreateProductRequest = req.body;

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check for duplicate SKU
    const skuCheck = await client.query(
      'SELECT id FROM products WHERE sku = $1',
      [data.sku]
    );
    if (skuCheck.rows.length > 0) {
      throw new ConflictError('Product with this SKU already exists', { sku: data.sku });
    }

    // Check for duplicate slug
    const slugCheck = await client.query(
      'SELECT id FROM products WHERE slug = $1',
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      throw new ConflictError('Product with this slug already exists', { slug });
    }

    await client.query('BEGIN');

    // Insert product
    const productQuery = `
      INSERT INTO products (
        name, slug, sku, barcode, description, short_description,
        price, sale_price, cost_price, category_id, brand_id,
        status, visibility, product_type,
        weight, length, width, height,
        is_featured, is_new, allow_backorder, track_inventory,
        published_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING id
    `;

    const productValues = [
      data.name,
      slug,
      data.sku,
      data.barcode || null,
      data.description || null,
      data.shortDescription || null,
      data.price,
      data.salePrice || null,
      data.costPrice || null,
      data.categoryId || null,
      data.brandId || null,
      data.status || 'draft',
      data.visibility || 'public',
      data.productType || 'simple',
      data.weight || null,
      data.length || null,
      data.width || null,
      data.height || null,
      data.isFeatured || false,
      data.isNew || false,
      data.allowBackorder || false,
      data.trackInventory !== false,
      data.publishedAt || null,
      authReq.user?.id || null,
    ];

    const productResult = await client.query(productQuery, productValues);
    const productId = productResult.rows[0].id;

    // Insert images
    if (data.images && data.images.length > 0) {
      for (const image of data.images) {
        await client.query(
          `INSERT INTO product_images (product_id, url, alt_text, title, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            productId,
            image.url,
            image.altText || null,
            image.title || null,
            image.isPrimary || false,
            image.sortOrder || 0,
          ]
        );
      }
    }

    // Insert attributes
    if (data.attributes && data.attributes.length > 0) {
      for (const attr of data.attributes) {
        await client.query(
          `INSERT INTO product_attributes (product_id, attribute_id, value)
           VALUES ($1, $2, $3)`,
          [productId, attr.attributeId, attr.value]
        );
      }
    }

    // Insert inventory
    if (data.inventory) {
      await client.query(
        `INSERT INTO product_inventory (product_id, quantity, low_stock_threshold)
         VALUES ($1, $2, $3)`,
        [productId, data.inventory.quantity, data.inventory.lowStockThreshold || 10]
      );
    } else {
      // Create default inventory record
      await client.query(
        `INSERT INTO product_inventory (product_id, quantity, low_stock_threshold)
         VALUES ($1, 0, 10)`,
        [productId]
      );
    }

    // Insert SEO
    if (data.seo) {
      await client.query(
        `INSERT INTO product_seo (
          product_id, meta_title, meta_description, meta_keywords,
          og_title, og_description, og_image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          productId,
          data.seo.metaTitle || null,
          data.seo.metaDescription || null,
          data.seo.metaKeywords || null,
          data.seo.ogTitle || null,
          data.seo.ogDescription || null,
          data.seo.ogImageUrl || null,
        ]
      );
    }

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'product',
      aggregateId: productId,
      eventType: 'PRODUCT_CREATED',
      payload: {
        productId,
        name: data.name,
        sku: data.sku,
        status: data.status || 'draft',
        createdBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.product.invalidateLists();

    logger.info('Product created', {
      productId,
      name: data.name,
      sku: data.sku,
      createdBy: authReq.user?.id,
    });

    // Fetch and return the created product
    const createdProduct = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    sendSuccess(res, createdProduct.rows[0], 'Product created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};


/**
 * Update product
 * PUT /api/v1/products/:id
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const data: Partial<CreateProductRequest> = req.body;

    // Check if product exists
    const existingProduct = await client.query(
      'SELECT id, sku, slug FROM products WHERE id = $1',
      [id]
    );

    if (existingProduct.rows.length === 0) {
      throw new NotFoundError('Product', id);
    }

    // Check for duplicate SKU if changing
    if (data.sku && data.sku !== existingProduct.rows[0].sku) {
      const skuCheck = await client.query(
        'SELECT id FROM products WHERE sku = $1 AND id != $2',
        [data.sku, id]
      );
      if (skuCheck.rows.length > 0) {
        throw new ConflictError('Product with this SKU already exists', { sku: data.sku });
      }
    }

    // Check for duplicate slug if changing
    if (data.slug && data.slug !== existingProduct.rows[0].slug) {
      const slugCheck = await client.query(
        'SELECT id FROM products WHERE slug = $1 AND id != $2',
        [data.slug, id]
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('Product with this slug already exists', { slug: data.slug });
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
      sku: 'sku',
      barcode: 'barcode',
      description: 'description',
      shortDescription: 'short_description',
      price: 'price',
      salePrice: 'sale_price',
      costPrice: 'cost_price',
      categoryId: 'category_id',
      brandId: 'brand_id',
      status: 'status',
      visibility: 'visibility',
      productType: 'product_type',
      weight: 'weight',
      length: 'length',
      width: 'width',
      height: 'height',
      isFeatured: 'is_featured',
      isNew: 'is_new',
      allowBackorder: 'allow_backorder',
      trackInventory: 'track_inventory',
      publishedAt: 'published_at',
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
        UPDATE products
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `;

      await client.query(updateQuery, updateValues);
    }

    // Update images if provided
    if (data.images) {
      // Delete existing images
      await client.query('DELETE FROM product_images WHERE product_id = $1', [id]);

      // Insert new images
      for (const image of data.images) {
        await client.query(
          `INSERT INTO product_images (product_id, url, alt_text, title, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            image.url,
            image.altText || null,
            image.title || null,
            image.isPrimary || false,
            image.sortOrder || 0,
          ]
        );
      }
    }

    // Update attributes if provided
    if (data.attributes) {
      // Delete existing attributes
      await client.query('DELETE FROM product_attributes WHERE product_id = $1', [id]);

      // Insert new attributes
      for (const attr of data.attributes) {
        await client.query(
          `INSERT INTO product_attributes (product_id, attribute_id, value)
           VALUES ($1, $2, $3)`,
          [id, attr.attributeId, attr.value]
        );
      }
    }

    // Update inventory if provided
    if (data.inventory) {
      await client.query(
        `UPDATE product_inventory
         SET quantity = $1, low_stock_threshold = $2
         WHERE product_id = $3`,
        [data.inventory.quantity, data.inventory.lowStockThreshold || 10, id]
      );
    }

    // Update SEO if provided
    if (data.seo) {
      const seoCheck = await client.query(
        'SELECT id FROM product_seo WHERE product_id = $1',
        [id]
      );

      if (seoCheck.rows.length > 0) {
        await client.query(
          `UPDATE product_seo
           SET meta_title = $1, meta_description = $2, meta_keywords = $3,
               og_title = $4, og_description = $5, og_image_url = $6
           WHERE product_id = $7`,
          [
            data.seo.metaTitle || null,
            data.seo.metaDescription || null,
            data.seo.metaKeywords || null,
            data.seo.ogTitle || null,
            data.seo.ogDescription || null,
            data.seo.ogImageUrl || null,
            id,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO product_seo (
            product_id, meta_title, meta_description, meta_keywords,
            og_title, og_description, og_image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            data.seo.metaTitle || null,
            data.seo.metaDescription || null,
            data.seo.metaKeywords || null,
            data.seo.ogTitle || null,
            data.seo.ogDescription || null,
            data.seo.ogImageUrl || null,
          ]
        );
      }
    }

    // Write to outbox for event publishing
    await outboxService.writeEvent(client, {
      aggregateType: 'product',
      aggregateId: id,
      eventType: 'PRODUCT_UPDATED',
      payload: {
        productId: id,
        updatedFields: Object.keys(data),
        updatedBy: authReq.user?.id,
      },
    });

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();

    logger.info('Product updated', {
      productId: id,
      updatedFields: Object.keys(data),
      updatedBy: authReq.user?.id,
    });

    // Fetch and return the updated product
    const updatedProduct = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    sendSuccess(res, updatedProduct.rows[0], 'Product updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};


/**
 * Delete product
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await client.query(
      'SELECT id, name FROM products WHERE id = $1',
      [id]
    );

    if (existingProduct.rows.length === 0) {
      throw new NotFoundError('Product', id);
    }

    await client.query('BEGIN');

    // Write to outbox before deletion
    await outboxService.writeEvent(client, {
      aggregateType: 'product',
      aggregateId: id,
      eventType: 'PRODUCT_DELETED',
      payload: {
        productId: id,
        name: existingProduct.rows[0].name,
        deletedBy: authReq.user?.id,
      },
    });

    // Delete product (cascades to related tables)
    await client.query('DELETE FROM products WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Invalidate cache
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();

    logger.info('Product deleted', {
      productId: id,
      deletedBy: authReq.user?.id,
    });

    sendSuccess(res, { id }, 'Product deleted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Bulk update product status
 * POST /api/v1/products/bulk-update-status
 */
export const bulkUpdateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { productIds, status }: BulkUpdateStatusRequest = req.body;

    await client.query('BEGIN');

    // Update products
    const updateQuery = `
      UPDATE products
      SET status = $1, updated_by = $2
      WHERE id = ANY($3)
      RETURNING id, name
    `;

    const result = await client.query(updateQuery, [
      status,
      authReq.user?.id || null,
      productIds,
    ]);

    // Write to outbox for each product
    for (const product of result.rows) {
      await outboxService.writeEvent(client, {
        aggregateType: 'product',
        aggregateId: product.id,
        eventType: 'PRODUCT_UPDATED',
        payload: {
          productId: product.id,
          name: product.name,
          newStatus: status,
          updatedBy: authReq.user?.id,
        },
      });
    }

    await client.query('COMMIT');

    // Invalidate cache
    for (const id of productIds) {
      await cacheService.product.invalidateDetail(id);
    }
    await cacheService.product.invalidateLists();

    logger.info('Bulk status update completed', {
      productCount: result.rows.length,
      status,
      updatedBy: authReq.user?.id,
    });

    sendSuccess(
      res,
      { updatedCount: result.rows.length, productIds: result.rows.map((r: any) => r.id) },
      `${result.rows.length} products updated successfully`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Bulk update product category
 * POST /api/v1/products/bulk-update-category
 */
export const bulkUpdateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = await db.getClient();
  
  try {
    const authReq = req as AuthRequest;
    const { productIds, categoryId }: BulkUpdateCategoryRequest = req.body;

    // Verify category exists
    const categoryCheck = await client.query(
      'SELECT id, name FROM categories WHERE id = $1',
      [categoryId]
    );

    if (categoryCheck.rows.length === 0) {
      throw new NotFoundError('Category', categoryId);
    }

    await client.query('BEGIN');

    // Update products
    const updateQuery = `
      UPDATE products
      SET category_id = $1, updated_by = $2
      WHERE id = ANY($3)
      RETURNING id, name
    `;

    const result = await client.query(updateQuery, [
      categoryId,
      authReq.user?.id || null,
      productIds,
    ]);

    // Write to outbox for each product
    for (const product of result.rows) {
      await outboxService.writeEvent(client, {
        aggregateType: 'product',
        aggregateId: product.id,
        eventType: 'PRODUCT_UPDATED',
        payload: {
          productId: product.id,
          name: product.name,
          newCategoryId: categoryId,
          categoryName: categoryCheck.rows[0].name,
          updatedBy: authReq.user?.id,
        },
      });
    }

    await client.query('COMMIT');

    // Invalidate cache
    for (const id of productIds) {
      await cacheService.product.invalidateDetail(id);
    }
    await cacheService.product.invalidateLists();

    logger.info('Bulk category update completed', {
      productCount: result.rows.length,
      categoryId,
      updatedBy: authReq.user?.id,
    });

    sendSuccess(
      res,
      { updatedCount: result.rows.length, productIds: result.rows.map((r: any) => r.id) },
      `${result.rows.length} products updated successfully`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Upload product image
 * POST /api/v1/products/:id/images
 */
export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const file = (req as any).file;

    if (!file) {
      throw new ValidationError('No image file provided');
    }

    // Check if product exists
    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (productCheck.rows.length === 0) {
      throw new NotFoundError('Product', id);
    }

    // In a real implementation, upload to S3 or similar storage
    // For now, we'll use a placeholder URL
    const imageUrl = `/uploads/products/${id}/${file.filename}`;

    // Insert image record
    const imageQuery = `
      INSERT INTO product_images (
        product_id, url, alt_text, title, is_primary, sort_order,
        width, height, file_size, mime_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const imageValues = [
      id,
      imageUrl,
      req.body.altText || null,
      req.body.title || null,
      req.body.isPrimary || false,
      req.body.sortOrder || 0,
      file.width || null,
      file.height || null,
      file.size,
      file.mimetype,
    ];

    const result = await db.query(imageQuery, imageValues);

    // Invalidate cache
    await cacheService.product.invalidateDetail(id);
    await cacheService.product.invalidateLists();

    logger.info('Product image uploaded', {
      productId: id,
      imageId: result.rows[0].id,
      fileSize: file.size,
    });

    sendSuccess(res, result.rows[0], 'Image uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};
