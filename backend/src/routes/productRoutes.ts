/**
 * Product Routes
 * API versioning: /api/v1/products
 * 
 * Features:
 * - CRUD operations with validation
 * - Filtering, sorting, pagination
 * - Bulk operations (status, category)
 * - Image upload
 * - Rate limiting (100 req/min per user)
 * - RBAC permission middleware (admin, merchant roles)
 * - Idempotency key handling for create/update
 * - Request/response logging with correlation IDs
 * - Caching for product list and details
 * - OpenAPI documentation annotations
 * - Outbox event publishing for product changes
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateStatus,
  bulkUpdateCategory,
  uploadImage,
} from '../controllers/productController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { idempotency } from '../middleware/idempotency';
import { validateCsrfToken } from '../middleware/csrf';
import {
  productRateLimiter,
  strictRateLimiter,
  uploadRateLimiter,
  bulkOperationRateLimiter,
} from '../middleware/rateLimiter';
import {
  createProductSchema,
  updateProductSchema,
  getProductSchema,
  deleteProductSchema,
  listProductsSchema,
  bulkUpdateStatusSchema,
  bulkUpdateCategorySchema,
  uploadImageSchema,
} from '../validation/productSchemas';
import config from '../config';

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(config.upload.uploadDir, 'products'));
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
});

/**
 * @route   GET /api/v1/products
 * @desc    List products with filtering, sorting, and pagination
 * @access  Public (with optional auth for personalized results)
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: string (default: 'created_at')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 * - status: ProductStatus | ProductStatus[] (filter by status)
 * - visibility: ProductVisibility (filter by visibility)
 * - categoryId: UUID (filter by category)
 * - brandId: UUID (filter by brand)
 * - minPrice: number (minimum price filter)
 * - maxPrice: number (maximum price filter)
 * - isFeatured: boolean (filter featured products)
 * - isNew: boolean (filter new products)
 * - isOnSale: boolean (filter products on sale)
 * - inStock: boolean (filter in-stock products)
 * - search: string (full-text search)
 * 
 * Response: PaginatedResponse<Product>
 */
router.get(
  '/',
  productRateLimiter,
  validateRequest(listProductsSchema),
  listProducts
);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product by ID with full details
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Product (with images, attributes, inventory, SEO)
 */
router.get(
  '/:id',
  productRateLimiter,
  validateRequest(getProductSchema),
  getProduct
);

/**
 * @route   POST /api/v1/products
 * @desc    Create new product
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:write
 * 
 * Request Body: CreateProductRequest
 * Response: Product
 */
router.post(
  '/',
  authenticate,
  requirePermission('products', 'write'),
  validateCsrfToken,
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(createProductSchema),
  createProduct
);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:write
 * 
 * Request Body: UpdateProductRequest
 * Response: Product
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('products', 'write'),
  validateCsrfToken,
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(updateProductSchema),
  updateProduct
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product
 * @access  Private (admin)
 * @rateLimit 50 requests per 15 minutes
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:delete
 * 
 * Response: { id: string }
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('products', 'delete'),
  validateCsrfToken,
  strictRateLimiter,
  validateRequest(deleteProductSchema),
  deleteProduct
);

/**
 * @route   POST /api/v1/products/bulk-update-status
 * @desc    Bulk update product status
 * @access  Private (admin, merchant)
 * @rateLimit 10 requests per 15 minutes
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:write
 * 
 * Request Body: BulkUpdateStatusRequest
 * Response: { updatedCount: number, productIds: string[] }
 */
router.post(
  '/bulk-update-status',
  authenticate,
  requirePermission('products', 'write'),
  validateCsrfToken,
  bulkOperationRateLimiter,
  validateRequest(bulkUpdateStatusSchema),
  bulkUpdateStatus
);

/**
 * @route   POST /api/v1/products/bulk-update-category
 * @desc    Bulk update product category
 * @access  Private (admin, merchant)
 * @rateLimit 10 requests per 15 minutes
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:write
 * 
 * Request Body: BulkUpdateCategoryRequest
 * Response: { updatedCount: number, productIds: string[] }
 */
router.post(
  '/bulk-update-category',
  authenticate,
  requirePermission('products', 'write'),
  validateCsrfToken,
  bulkOperationRateLimiter,
  validateRequest(bulkUpdateCategorySchema),
  bulkUpdateCategory
);

/**
 * @route   POST /api/v1/products/:id/images
 * @desc    Upload product image
 * @access  Private (admin, merchant)
 * @rateLimit 20 requests per 15 minutes
 * @csrf CSRF token required in X-CSRF-Token header
 * 
 * Required permissions: products:write
 * 
 * Request: multipart/form-data with 'image' field
 * Optional fields: altText, title, isPrimary, sortOrder
 * 
 * Response: ProductImage
 */
router.post(
  '/:id/images',
  authenticate,
  requirePermission('products', 'write'),
  validateCsrfToken,
  uploadRateLimiter,
  upload.single('image'),
  validateRequest(uploadImageSchema),
  uploadImage
);

export default router;
