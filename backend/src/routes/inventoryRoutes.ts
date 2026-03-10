/**
 * Inventory Routes
 * 
 * API routes for inventory management.
 */

import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  reserveInventorySchema,
  deductInventorySchema,
  releaseInventorySchema,
  updateInventorySchema,
  getInventorySchema,
  checkInventorySchema,
  getLowStockAlertsSchema,
} from '../validation/inventorySchemas';
import { productRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting (100 requests per 15 minutes per user)
router.use(productRateLimiter);

/**
 * @route   GET /api/v1/inventory/:productId
 * @desc    Get inventory for a product
 * @access  Private (authenticated users)
 */
router.get(
  '/:productId',
  validateRequest(getInventorySchema),
  inventoryController.getInventory
);

/**
 * @route   POST /api/v1/inventory/reserve
 * @desc    Reserve inventory for pending orders
 * @access  Private (authenticated users)
 */
router.post(
  '/reserve',
  validateRequest(reserveInventorySchema),
  inventoryController.reserveInventory
);

/**
 * @route   POST /api/v1/inventory/deduct
 * @desc    Deduct inventory (confirm order)
 * @access  Private (authenticated users)
 */
router.post(
  '/deduct',
  validateRequest(deductInventorySchema),
  inventoryController.deductInventory
);

/**
 * @route   POST /api/v1/inventory/release
 * @desc    Release reserved inventory (cancel order)
 * @access  Private (authenticated users)
 */
router.post(
  '/release',
  validateRequest(releaseInventorySchema),
  inventoryController.releaseInventory
);

/**
 * @route   PUT /api/v1/inventory/:productId
 * @desc    Update inventory quantity (restock)
 * @access  Private (admin only)
 */
router.put(
  '/:productId',
  validateRequest(updateInventorySchema),
  inventoryController.updateInventory
);

/**
 * @route   POST /api/v1/inventory/check
 * @desc    Check inventory availability for multiple products
 * @access  Private (authenticated users)
 */
router.post(
  '/check',
  validateRequest(checkInventorySchema),
  inventoryController.checkInventory
);

/**
 * @route   GET /api/v1/inventory/alerts/low-stock
 * @desc    Get low stock alerts
 * @access  Private (admin only)
 */
router.get(
  '/alerts/low-stock',
  validateRequest(getLowStockAlertsSchema),
  inventoryController.getLowStockAlerts
);

export default router;
