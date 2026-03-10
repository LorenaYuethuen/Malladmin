/**
 * Attribute Routes
 * API versioning: /api/v1/attributes
 *
 * Features:
 * - CRUD operations with validation
 * - Product attribute associations
 * - Attribute type validation (text, select, multiselect, color, number, boolean)
 * - Rate limiting (100 req/min per user)
 * - RBAC permission middleware (admin, merchant roles)
 * - Caching for attribute list and details
 * - OpenAPI documentation annotations
 * - Outbox event publishing for attribute changes
 */

import { Router } from 'express';
import {
  listAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributesByProduct,
} from '../controllers/attributeController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { idempotency } from '../middleware/idempotency';
import {
  productRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimiter';
import {
  createAttributeSchema,
  updateAttributeSchema,
  getAttributeSchema,
  deleteAttributeSchema,
  listAttributesSchema,
  getAttributesByProductSchema,
} from '../validation/attributeSchemas';

const router = Router();

/**
 * @route   GET /api/v1/attributes
 * @desc    List attributes with filtering, sorting, and pagination
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'created_at' | 'sort_order' | 'type' (default: 'sort_order')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * - type: 'text' | 'select' | 'multiselect' | 'color' | 'number' | 'boolean' (filter by type)
 * - isFilterable: boolean (filter by filterable status)
 * - isVisible: boolean (filter by visible status)
 * - search: string (search in name and description)
 * 
 * Response: PaginatedResponse<Attribute>
 */
router.get(
  '/',
  productRateLimiter,
  validateRequest(listAttributesSchema),
  listAttributes
);

/**
 * @route   GET /api/v1/attributes/by-product/:productId
 * @desc    Get all attributes for a specific product
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Attribute[] (with value field for each attribute)
 */
router.get(
  '/by-product/:productId',
  productRateLimiter,
  validateRequest(getAttributesByProductSchema),
  getAttributesByProduct
);

/**
 * @route   GET /api/v1/attributes/:id
 * @desc    Get single attribute by ID with product usage count
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Attribute (with productCount and recentProducts)
 */
router.get(
  '/:id',
  productRateLimiter,
  validateRequest(getAttributeSchema),
  getAttribute
);

/**
 * @route   POST /api/v1/attributes
 * @desc    Create new attribute
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: attributes:write
 * 
 * Request Body:
 * - name: string (required, unique)
 * - slug: string (optional, auto-generated from name)
 * - type: 'text' | 'select' | 'multiselect' | 'color' | 'number' | 'boolean' (required)
 * - options: Array<{value: string, label: string}> (required for select/multiselect)
 * - isRequired: boolean (optional, default: false)
 * - isFilterable: boolean (optional, default: true)
 * - isVisible: boolean (optional, default: true)
 * - sortOrder: number (optional, default: 0)
 * - description: string (optional)
 * 
 * Validations:
 * - Options are required for select and multiselect types
 * - Options should not be provided for other types
 * - Name and slug must be unique
 * 
 * Response: Attribute
 */
router.post(
  '/',
  authenticate,
  requirePermission('attributes', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(createAttributeSchema),
  createAttribute
);

/**
 * @route   PUT /api/v1/attributes/:id
 * @desc    Update attribute
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: attributes:write
 * 
 * Request Body: Partial<CreateAttributeRequest>
 * 
 * Validations:
 * - Cannot change type if attribute is used by products
 * - Checks for duplicate name and slug
 * - Options validation based on type
 * 
 * Response: Attribute
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('attributes', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(updateAttributeSchema),
  updateAttribute
);

/**
 * @route   DELETE /api/v1/attributes/:id
 * @desc    Delete attribute
 * @access  Private (admin)
 * @rateLimit 50 requests per 15 minutes
 * 
 * Required permissions: attributes:delete
 * 
 * Validations:
 * - Cannot delete attribute that is used by products
 * 
 * Response: { id: string }
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('attributes', 'delete'),
  strictRateLimiter,
  validateRequest(deleteAttributeSchema),
  deleteAttribute
);

export default router;

