/**
 * Inventory Controller
 * 
 * HTTP request handlers for inventory management.
 * Uses standard error codes: ERR_2003 (insufficient stock),
 * ERR_2011 (reservation failure), ERR_2012 (deduction failure),
 * ERR_2013 (release failure).
 */

import { Request, Response, NextFunction } from 'express';
import * as inventoryService from '../services/inventoryService';
import { successResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * Get inventory for a product
 * GET /api/v1/inventory/:productId
 */
export async function getInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId } = req.params;
    const inventory = await inventoryService.getInventoryByProductId(productId);

    res.json(successResponse(inventory));
  } catch (error) {
    next(error);
  }
}

/**
 * Reserve inventory
 * POST /api/v1/inventory/reserve
 */
export async function reserveInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await inventoryService.reserveInventory(req.body);

    if (!result.success) {
      // Determine the primary error code based on failure reasons
      const hasInsufficientStock = result.failedItems?.some(
        (f) => f.reason.includes('ERR_2003')
      );
      const errorCode = hasInsufficientStock ? 'ERR_2003' : 'ERR_2011';
      const errorMessage = hasInsufficientStock
        ? 'Insufficient stock for one or more items'
        : 'Failed to reserve inventory for some items';

      res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: result.failedItems,
        },
        data: { results: result.results },
      });
      return;
    }

    logger.info('Inventory reserved via API', {
      itemCount: result.results.length,
      orderId: req.body.orderId,
      requestId: res.locals.requestId,
    });

    res.json(successResponse(result, 'Inventory reserved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Deduct inventory (confirm reservation on payment)
 * POST /api/v1/inventory/deduct
 */
export async function deductInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await inventoryService.deductInventory(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_2012',
          message: 'Failed to deduct inventory for some items',
          details: result.failedItems,
        },
        data: { results: result.results },
      });
      return;
    }

    logger.info('Inventory deducted via API', {
      itemCount: result.results.length,
      orderId: req.body.orderId,
      requestId: res.locals.requestId,
    });

    res.json(successResponse(result, 'Inventory deducted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Release inventory (cancel reservation)
 * POST /api/v1/inventory/release
 */
export async function releaseInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await inventoryService.releaseInventory(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_2013',
          message: 'Failed to release inventory for some items',
          details: result.failedItems,
        },
        data: { results: result.results },
      });
      return;
    }

    logger.info('Inventory released via API', {
      itemCount: result.results.length,
      orderId: req.body.orderId,
      requestId: res.locals.requestId,
    });

    res.json(successResponse(result, 'Inventory released successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Update inventory
 * PUT /api/v1/inventory/:productId
 */
export async function updateInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId } = req.params;
    const inventory = await inventoryService.updateInventory(productId, req.body);

    logger.info('Inventory updated via API', {
      productId,
      quantity: req.body.quantity,
      requestId: res.locals.requestId,
    });

    res.json(successResponse(inventory, 'Inventory updated successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Check inventory availability
 * POST /api/v1/inventory/check
 */
export async function checkInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await inventoryService.checkInventoryAvailability(req.body.items);
    const allAvailable = results.every((r) => r.available);

    res.json(
      successResponse({
        allAvailable,
        items: results,
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get low stock alerts
 * GET /api/v1/inventory/alerts/low-stock
 */
export async function getLowStockAlerts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const alerts = await inventoryService.getLowStockAlerts(limit);

    res.json(
      successResponse({
        alerts,
        count: alerts.length,
      })
    );
  } catch (error) {
    next(error);
  }
}
