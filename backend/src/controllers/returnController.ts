/**
 * Return Controller
 * 
 * HTTP request handlers for return and refund management.
 * Supports the return status flow: pending → approved → refunding → completed / rejected
 */

import { Request, Response, NextFunction } from 'express';
import * as returnService from '../services/returnService';
import { ReturnStatus } from '../types/return';
import { successResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * Create a new return request
 * POST /api/v1/returns
 */
export async function createReturnRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const returnRequest = await returnService.createReturnRequest(req.body);

    logger.info('Return request created via API', {
      returnId: returnRequest.id,
      returnNumber: returnRequest.returnNumber,
      requestId: res.locals.requestId,
    });

    res.status(201).json(
      successResponse(returnRequest, 'Return request created successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get return request by ID
 * GET /api/v1/returns/:id
 */
export async function getReturnRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const returnRequest = await returnService.getReturnRequestById(id);

    res.json(successResponse(returnRequest));
  } catch (error) {
    next(error);
  }
}

/**
 * List return requests with filters
 * GET /api/v1/returns
 */
export async function listReturnRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      filters: {
        status: req.query.status as any,
        userId: req.query.userId as string,
        orderId: req.query.orderId as string,
        returnNumber: req.query.returnNumber as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      },
    };

    const result = await returnService.listReturnRequests(query);

    res.json(
      successResponse({
        items: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.page * result.limit < result.total,
          hasPrev: result.page > 1,
        },
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Update return request status
 * PUT /api/v1/returns/:id/status
 * 
 * Supports the full status flow:
 *   pending → approved → refunding → completed
 *   pending → rejected
 */
export async function updateReturnStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { status, adminNotes, refundAmount } = req.body;

    const returnRequest = await returnService.updateReturnRequestStatus(
      id,
      status as ReturnStatus,
      adminNotes,
      refundAmount
    );

    logger.info('Return request status updated via API', {
      returnId: id,
      newStatus: status,
      requestId: res.locals.requestId,
    });

    res.json(
      successResponse(returnRequest, `Return request status updated to '${status}' successfully`)
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Process return request (approve/reject/complete)
 * PUT /api/v1/returns/:id/process
 * 
 * Legacy endpoint - delegates to updateReturnRequestStatus
 */
export async function processReturnRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body;

    // Map action to status
    const actionToStatus: Record<string, ReturnStatus> = {
      approve: ReturnStatus.APPROVED,
      reject: ReturnStatus.REJECTED,
      complete: ReturnStatus.COMPLETED,
    };

    const newStatus = actionToStatus[action];
    if (!newStatus) {
      throw new Error('Invalid action');
    }

    const returnRequest = await returnService.updateReturnRequestStatus(
      id,
      newStatus,
      adminNotes
    );

    logger.info('Return request processed', {
      returnId: id,
      action,
      requestId: res.locals.requestId,
    });

    res.json(
      successResponse(returnRequest, `Return request ${action}d successfully`)
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel return request
 * DELETE /api/v1/returns/:id
 */
export async function cancelReturnRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const returnRequest = await returnService.cancelReturnRequest(id);

    logger.info('Return request cancelled', {
      returnId: id,
      requestId: res.locals.requestId,
    });

    res.json(successResponse(returnRequest, 'Return request cancelled successfully'));
  } catch (error) {
    next(error);
  }
}
