/**
 * Attribute Validation Schemas
 * Zod schemas for validating attribute-related requests
 */

import { z } from 'zod';

/**
 * Attribute types enum
 */
export const AttributeType = z.enum(['text', 'select', 'multiselect', 'color', 'number', 'boolean']);

/**
 * Option schema for select/multiselect types
 */
const optionSchema = z.object({
  value: z.string().min(1, 'Option value is required'),
  label: z.string().min(1, 'Option label is required'),
});

/**
 * Schema for creating an attribute
 */
export const createAttributeSchema = {
  body: z.object({
    name: z.string().min(1, 'Attribute name is required').max(255, 'Attribute name must be less than 255 characters'),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format').optional(),
    type: AttributeType,
    options: z.array(optionSchema).optional(),
    isRequired: z.boolean().optional(),
    isFilterable: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    description: z.string().optional(),
  }).refine(
    (data) => {
      // Options are required for select and multiselect types
      if ((data.type === 'select' || data.type === 'multiselect') && (!data.options || data.options.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Options are required for select and multiselect attribute types',
      path: ['options'],
    }
  ).refine(
    (data) => {
      // Options should not be provided for non-select types
      if (data.type !== 'select' && data.type !== 'multiselect' && data.options && data.options.length > 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Options should only be provided for select and multiselect types',
      path: ['options'],
    }
  ),
};

/**
 * Schema for updating an attribute
 */
export const updateAttributeSchema = {
  params: z.object({
    id: z.string().uuid('Invalid attribute ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    type: AttributeType.optional(),
    options: z.array(optionSchema).optional().nullable(),
    isRequired: z.boolean().optional(),
    isFilterable: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    description: z.string().optional().nullable(),
  }).refine(
    (data) => {
      // If type is being changed to select/multiselect, options must be provided
      if ((data.type === 'select' || data.type === 'multiselect') && data.options !== undefined && (!data.options || data.options.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Options are required for select and multiselect attribute types',
      path: ['options'],
    }
  ),
};

/**
 * Schema for getting a single attribute
 */
export const getAttributeSchema = {
  params: z.object({
    id: z.string().uuid('Invalid attribute ID'),
  }),
};

/**
 * Schema for deleting an attribute
 */
export const deleteAttributeSchema = {
  params: z.object({
    id: z.string().uuid('Invalid attribute ID'),
  }),
};

/**
 * Schema for listing attributes
 */
export const listAttributesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(['name', 'created_at', 'sort_order', 'type']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    type: AttributeType.optional(),
    isFilterable: z.enum(['true', 'false']).optional(),
    isVisible: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }).optional(),
};

/**
 * Schema for getting attributes by product
 */
export const getAttributesByProductSchema = {
  params: z.object({
    productId: z.string().uuid('Invalid product ID'),
  }),
};

export type CreateAttributeRequest = z.infer<typeof createAttributeSchema.body>;
export type UpdateAttributeRequest = z.infer<typeof updateAttributeSchema.body>;
export type AttributeListQuery = z.infer<NonNullable<typeof listAttributesSchema.query>>;

