/**
 * Zod validation schemas for Product API
 */

import { z } from 'zod';
import { ProductStatus, ProductVisibility, ProductType } from '../types/product';

// Base product schema
export const createProductSchema = {
  body: z.object({
    name: z.string().min(1, 'Product name is required').max(500, 'Name too long'),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format').optional(),
    sku: z.string().min(1, 'SKU is required').max(100, 'SKU too long'),
    barcode: z.string().max(100).optional(),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    
    // Pricing
    price: z.number().min(0, 'Price must be non-negative'),
    salePrice: z.number().min(0, 'Sale price must be non-negative').optional(),
    costPrice: z.number().min(0, 'Cost price must be non-negative').optional(),
    
    // Relationships
    categoryId: z.string().uuid('Invalid category ID').optional(),
    brandId: z.string().uuid('Invalid brand ID').optional(),
    
    // Status
    status: z.nativeEnum(ProductStatus).optional(),
    visibility: z.nativeEnum(ProductVisibility).optional(),
    productType: z.nativeEnum(ProductType).optional(),
    
    // Shipping
    weight: z.number().min(0).optional(),
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    
    // Flags
    isFeatured: z.boolean().optional(),
    isNew: z.boolean().optional(),
    allowBackorder: z.boolean().optional(),
    trackInventory: z.boolean().optional(),
    
    // Timestamps
    publishedAt: z.string().datetime().optional(),
    
    // Related data
    images: z.array(z.object({
      url: z.string().url('Invalid image URL'),
      altText: z.string().optional(),
      title: z.string().optional(),
      isPrimary: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })).optional(),
    
    attributes: z.array(z.object({
      attributeId: z.string().uuid('Invalid attribute ID'),
      value: z.string().min(1, 'Attribute value is required'),
    })).optional(),
    
    inventory: z.object({
      quantity: z.number().int().min(0, 'Quantity must be non-negative'),
      lowStockThreshold: z.number().int().min(0).optional(),
    }).optional(),
    
    seo: z.object({
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
      ogTitle: z.string().max(255).optional(),
      ogDescription: z.string().optional(),
      ogImageUrl: z.string().url().optional(),
    }).optional(),
  }).refine(
    (data) => !data.salePrice || data.salePrice < data.price,
    {
      message: 'Sale price must be less than regular price',
      path: ['salePrice'],
    }
  ),
};

export const updateProductSchema = {
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(500).optional(),
    slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    sku: z.string().min(1).max(100).optional(),
    barcode: z.string().max(100).optional(),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    
    price: z.number().min(0).optional(),
    salePrice: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    
    categoryId: z.string().uuid().optional().nullable(),
    brandId: z.string().uuid().optional().nullable(),
    
    status: z.nativeEnum(ProductStatus).optional(),
    visibility: z.nativeEnum(ProductVisibility).optional(),
    productType: z.nativeEnum(ProductType).optional(),
    
    weight: z.number().min(0).optional(),
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    
    isFeatured: z.boolean().optional(),
    isNew: z.boolean().optional(),
    allowBackorder: z.boolean().optional(),
    trackInventory: z.boolean().optional(),
    
    publishedAt: z.string().datetime().optional().nullable(),
    
    images: z.array(z.object({
      url: z.string().url(),
      altText: z.string().optional(),
      title: z.string().optional(),
      isPrimary: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })).optional(),
    
    attributes: z.array(z.object({
      attributeId: z.string().uuid(),
      value: z.string().min(1),
    })).optional(),
    
    inventory: z.object({
      quantity: z.number().int().min(0),
      lowStockThreshold: z.number().int().min(0).optional(),
    }).optional(),
    
    seo: z.object({
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().optional(),
      metaKeywords: z.string().optional(),
      ogTitle: z.string().max(255).optional(),
      ogDescription: z.string().optional(),
      ogImageUrl: z.string().url().optional(),
    }).optional(),
  }).refine(
    (data) => !data.salePrice || !data.price || data.salePrice < data.price,
    {
      message: 'Sale price must be less than regular price',
      path: ['salePrice'],
    }
  ),
};

export const getProductSchema = {
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
};

export const deleteProductSchema = {
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
};

export const listProductsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    
    // Filters
    status: z.union([
      z.nativeEnum(ProductStatus),
      z.string().transform((val) => val.split(',') as ProductStatus[]),
    ]).optional(),
    visibility: z.nativeEnum(ProductVisibility).optional(),
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    minPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    maxPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    isFeatured: z.string().transform((val) => val === 'true').optional(),
    isNew: z.string().transform((val) => val === 'true').optional(),
    isOnSale: z.string().transform((val) => val === 'true').optional(),
    inStock: z.string().transform((val) => val === 'true').optional(),
    search: z.string().optional(),
  }),
};

export const bulkUpdateStatusSchema = {
  body: z.object({
    productIds: z.array(z.string().uuid('Invalid product ID')).min(1, 'At least one product ID required'),
    status: z.nativeEnum(ProductStatus),
  }),
};

export const bulkUpdateCategorySchema = {
  body: z.object({
    productIds: z.array(z.string().uuid('Invalid product ID')).min(1, 'At least one product ID required'),
    categoryId: z.string().uuid('Invalid category ID'),
  }),
};

export const uploadImageSchema = {
  params: z.object({
    id: z.string().uuid('Invalid product ID'),
  }),
  body: z.object({
    altText: z.string().optional(),
    title: z.string().optional(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).optional(),
};
