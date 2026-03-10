/**
 * Brand Routes
 * API versioning: /api/v1/brands
 *
 * Features:
 * - CRUD operations with validation
 * - Logo upload with file validation
 * - Product count aggregation
 * - Rate limiting (100 req/min per user)
 * - RBAC permission middleware (admin, merchant roles)
 * - Caching for brand list and details
 * - OpenAPI documentation annotations
 * - Outbox event publishing for brand changes
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  listBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  uploadLogo,
} from '../controllers/brandController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { idempotency } from '../middleware/idempotency';
import {
  productRateLimiter,
  strictRateLimiter,
  uploadRateLimiter,
} from '../middleware/rateLimiter';
import {
  createBrandSchema,
  updateBrandSchema,
  getBrandSchema,
  deleteBrandSchema,
  listBrandsSchema,
  uploadLogoSchema,
} from '../validation/brandSchemas';
import config from '../config';

const router = Router();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(config.upload.uploadDir, 'brands'));
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed.'));
    }
  },
});

/**
 * @route   GET /api/v1/brands
 * @desc    List brands with filtering, sorting, and pagination
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'created_at' | 'sort_order' | 'product_count' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * - isActive: boolean (filter by active status)
 * - search: string (search in name and description)
 * 
 * Response: PaginatedResponse<Brand>
 */
router.get(
  '/',
  productRateLimiter,
  validateRequest(listBrandsSchema),
  listBrands
);

/**
 * @route   GET /api/v1/brands/:id
 * @desc    Get single brand by ID with product count and recent products
 * @access  Public
 * @rateLimit 100 requests per 15 minutes
 * 
 * Response: Brand (with productCount and recentProducts)
 */
router.get(
  '/:id',
  productRateLimiter,
  validateRequest(getBrandSchema),
  getBrand
);

/**
 * @route   POST /api/v1/brands
 * @desc    Create new brand
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: brands:write
 * 
 * Request Body:
 * - name: string (required, unique)
 * - slug: string (optional, auto-generated from name)
 * - description: string (optional)
 * - logoUrl: string (optional, URL)
 * - websiteUrl: string (optional, URL)
 * - isActive: boolean (optional, default: true)
 * - sortOrder: number (optional, default: 0)
 * - metaTitle: string (optional)
 * - metaDescription: string (optional)
 * - metaKeywords: string (optional)
 * 
 * Response: Brand
 */
router.post(
  '/',
  authenticate,
  requirePermission('brands', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(createBrandSchema),
  createBrand
);

/**
 * @route   PUT /api/v1/brands/:id
 * @desc    Update brand
 * @access  Private (admin, merchant)
 * @rateLimit 50 requests per 15 minutes
 * @idempotency Supported via X-Idempotency-Key header
 * 
 * Required permissions: brands:write
 * 
 * Request Body: Partial<CreateBrandRequest>
 * 
 * Validations:
 * - Checks for duplicate name
 * - Checks for duplicate slug
 * 
 * Response: Brand
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('brands', 'write'),
  strictRateLimiter,
  idempotency({ required: false }),
  validateRequest(updateBrandSchema),
  updateBrand
);

/**
 * @route   DELETE /api/v1/brands/:id
 * @desc    Delete brand
 * @access  Private (admin)
 * @rateLimit 50 requests per 15 minutes
 * 
 * Required permissions: brands:delete
 * 
 * Validations:
 * - Cannot delete brand with products
 * 
 * Response: { id: string }
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('brands', 'delete'),
  strictRateLimiter,
  validateRequest(deleteBrandSchema),
  deleteBrand
);

/**
 * @route   POST /api/v1/brands/:id/logo
 * @desc    Upload brand logo
 * @access  Private (admin, merchant)
 * @rateLimit 20 requests per 15 minutes
 * 
 * Required permissions: brands:write
 * 
 * Request: multipart/form-data with 'logo' field
 * Allowed file types: JPEG, PNG, WebP, SVG
 * Max file size: 5MB
 * 
 * Response: Brand (with updated logoUrl)
 */
router.post(
  '/:id/logo',
  authenticate,
  requirePermission('brands', 'write'),
  uploadRateLimiter,
  upload.single('logo'),
  validateRequest(uploadLogoSchema),
  uploadLogo
);

export default router;
