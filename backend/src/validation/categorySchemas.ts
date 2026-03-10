/**
 * Zod validation schemas for Category API
 */

import { z } from 'zod';

// Base category schema
export const createCategorySchema = {
  body: z.object({
    name: z.string().min(1, 'Category name is required').max(255, 'Name too long'),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format').optional(),
    description: z.string().optional(),
    parentId: z.string().uuid('Invalid parent category ID').optional().nullable(),
    sortOrder: z.number().int().min(0, 'Sort order must be non-negative').optional(),
    imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
    icon: z.string().max(100, 'Icon name too long').optional(),
    isActive: z.boolean().optional(),
    
    // SEO fields
    metaTitle: z.string().max(255, 'Meta title too long').optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
  }),
};

export const updateCategorySchema = {
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().optional(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
    icon: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
    
    // SEO fields
    metaTitle: z.string().max(255).optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
  }),
};

export const getCategorySchema = {
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
};

export const deleteCategorySchema = {
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
};

export const listCategoriesSchema = {
  query: z.object({
    parentId: z.string().uuid().optional(),
    isActive: z.string().transform((val) => val === 'true').optional(),
    includeChildren: z.string().transform((val) => val === 'true').optional(),
    level: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().optional(),
  }),
};
