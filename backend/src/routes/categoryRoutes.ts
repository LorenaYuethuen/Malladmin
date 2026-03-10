/**
 * Category Routes
 * API versioning: /api/v1/categories
 * 
 * Features:
 * - CRUD operations with validation
 * - Hierarchical category retrieval
 * - Parent-child relationship validation
 * - Slug generation
 * - Rate limiting (100 req/min per user)
 * - RBAC permission middleware (admin, merchant roles)
 * - Caching for category list and details
 * - OpenAPI documentation annotations
 * - Outbox event publishing for category changes
 */

import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { idempotency } from '../middleware/idempotency';
import {
  productRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimiter';
import {
  createCategorySchema,
  updateCategorySchema,
  getCategorySchema,
  deleteCategorySchema,
  listCategoriesSchema,
} from '../validation/categorySchemas';

const router = Router();

/**
 * @route   GET /api/v1/categories
 * @desc    List categories with optional hierarchical structure
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - parentId: UUID | 'null' (filter by parent category, 'null' for root categories)
 * - isActive: boolean (filter by active status)
 * - includeChildren: boolean (build hierarchical tree structure)
 * - level: number (filter by depth level)
 * - search: string (search in name and description)
 * 
 * Response: Category[] (flat list or hierarchical tree based on includeChildren)
 */
router.get(
  '/',
  productRateLimiter,
  validateRequest(listCategoriesSchema),
  listCategories
);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get single category by ID with parent and children
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Category (with parent info and children list)
 */
router.get(
  '/:id',
  productRateLimiter,
  validateRequest(getCategorySchema),
  getCategory
);

/**
 * @route   POST /api/v1/categories
 * @desc    Create new category
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: categories:write
 * 
 * Request Body:
 * - name: string (required)
 * - slug: string (optional, auto-generated from name)
 * - description: string (optional)
 * - parentId: UUID (optional, null for root category)
 * - sortOrder: number (optional, default: 0)
 * - imageUrl: string (optional)
 * - icon: string (optional)
 * - isActive: boolean (optional, default: true)
 * - metaTitle: string (optional)
 * - metaDescription: string (optional)
 * - metaKeywords: string (optional)
 * 
 * Response: Category
 */
router.post(
  '/',
  authenticate,
  requirePermission('categories', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(createCategorySchema),
  createCategory
);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update category
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: categories:write
 * 
 * Request Body: Partial<CreateCategoryRequest>
 * 
 * Validations:
 * - Prevents circular references (category cannot be its own ancestor)
 * - Validates parent category exists
 * - Checks for duplicate slugs
 * 
 * Response: Category
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('categories', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(updateCategorySchema),
  updateCategory
);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category
 * @access  Private (admin)
 * @rateLimit 50 requests per 15 minutes
 * 
 * Required permissions: categories:delete
 * 
 * Validations:
 * - Cannot delete category with subcategories
 * - Cannot delete category with products
 * 
 * Response: { id: string }
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('categories', 'delete'),
  strictRateLimiter,
  validateRequest(deleteCategorySchema),
  deleteCategory
);

export default router;
