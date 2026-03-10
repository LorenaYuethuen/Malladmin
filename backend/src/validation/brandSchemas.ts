/**
 * Brand Validation Schemas
 * Zod schemas for validating brand-related requests
 */

import { z } from 'zod';

/**
 * Schema for creating a brand
 */
export const createBrandSchema = {
  body: z.object({
    name: z.string().min(1, 'Brand name is required').max(255, 'Brand name must be less than 255 characters'),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    logoUrl: z.string().url('Invalid logo URL').optional(),
    websiteUrl: z.string().url('Invalid website URL').optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    metaTitle: z.string().max(255).optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
  }),
};

/**
 * Schema for updating a brand
 */
export const updateBrandSchema = {
  params: z.object({
    id: z.string().uuid('Invalid brand ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
    websiteUrl: z.string().url('Invalid website URL').optional().nullable(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    metaTitle: z.string().max(255).optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    metaKeywords: z.string().optional().nullable(),
  }),
};

/**
 * Schema for getting a single brand
 */
export const getBrandSchema = {
  params: z.object({
    id: z.string().uuid('Invalid brand ID'),
  }),
};

/**
 * Schema for deleting a brand
 */
export const deleteBrandSchema = {
  params: z.object({
    id: z.string().uuid('Invalid brand ID'),
  }),
};

/**
 * Schema for listing brands
 */
export const listBrandsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(['name', 'created_at', 'sort_order', 'product_count']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }).optional(),
};

/**
 * Schema for uploading brand logo
 */
export const uploadLogoSchema = {
  params: z.object({
    id: z.string().uuid('Invalid brand ID'),
  }),
};

export type CreateBrandRequest = z.infer<typeof createBrandSchema.body>;
export type UpdateBrandRequest = z.infer<typeof updateBrandSchema.body>;
export type BrandListQuery = z.infer<NonNullable<typeof listBrandsSchema.query>>;
