/**
 * Return Routes
 * 
 * API routes for return and refund management.
 */

import { Router } from 'express';
import * as returnController from '../controllers/returnController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createReturnRequestSchema,
  processReturnRequestSchema,
  getReturnRequestSchema,
  listReturnRequestsSchema,
  cancelReturnRequestSchema,
} from '../validation/returnSchemas';
import { strictRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting (50 requests per 15 minutes per user)
router.use(strictRateLimiter);

/**
 * @route   POST /api/v1/returns
 * @desc    Create a new return request
 * @access  Private (authenticated users)
 */
router.post(
  '/',
  validateRequest(createReturnRequestSchema),
  returnController.createReturnRequest
);

/**
 * @route   GET /api/v1/returns
 * @desc    List return requests with filters
 * @access  Private (authenticated users)
 */
router.get(
  '/',
  validateRequest(listReturnRequestsSchema),
  returnController.listReturnRequests
);

/**
 * @route   GET /api/v1/returns/:id
 * @desc    Get return request by ID
 * @access  Private (authenticated users)
 */
router.get(
  '/:id',
  validateRequest(getReturnRequestSchema),
  returnController.getReturnRequest
);

/**
 * @route   PUT /api/v1/returns/:id/process
 * @desc    Process return request (approve/reject/complete)
 * @access  Private (admin only)
 */
router.put(
  '/:id/process',
  validateRequest(processReturnRequestSchema),
  returnController.processReturnRequest
);

/**
 * @route   DELETE /api/v1/returns/:id
 * @desc    Cancel return request
 * @access  Private (authenticated users - own returns only)
 */
router.delete(
  '/:id',
  validateRequest(cancelReturnRequestSchema),
  returnController.cancelReturnRequest
);

export default router;
