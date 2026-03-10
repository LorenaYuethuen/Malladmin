/**
 * Return Service
 *
 * Business logic for return and refund management.
 * Implements the return status flow: pending → approved → refunding → completed / rejected
 */

import db from '../database/connection';
import {
  ReturnRequest,
  ReturnItem,
  CreateReturnRequest,
  ReturnListQuery,
  ReturnStatus,
  RefundStatus,
  VALID_STATUS_TRANSITIONS,
  generateReturnNumber,
} from '../types/return';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Create a new return request
 */
export async function createReturnRequest(
  data: CreateReturnRequest
): Promise<ReturnRequest> {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Verify order exists and belongs to user
    const orderResult = await client.query(
      'SELECT id, status, total FROM orders WHERE id = $1 AND user_id = $2',
      [data.orderId, data.userId]
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found or does not belong to user');
    }

    const order = orderResult.rows[0];

    // Check if order can be returned (must be delivered)
    if (order.status !== 'delivered') {
      throw new ValidationError('Only delivered orders can be returned');
    }

    // Verify all order items exist and calculate refund amount
    let totalRefundAmount = 0;

    for (const item of data.items) {
      const itemResult = await client.query(
        'SELECT id, total, quantity FROM order_items WHERE id = $1 AND order_id = $2',
        [item.orderItemId, data.orderId]
      );

      if (itemResult.rows.length === 0) {
        throw new NotFoundError('Order item ' + item.orderItemId + ' not found');
      }

      const orderItem = itemResult.rows[0];

      // Validate return quantity
      if (item.quantity > orderItem.quantity) {
        throw new ValidationError(
          'Return quantity (' + item.quantity + ') exceeds order quantity (' + orderItem.quantity + ')'
        );
      }

      // Calculate refund amount for this item (proportional)
      const itemRefundAmount = (parseFloat(orderItem.total) / orderItem.quantity) * item.quantity;
      totalRefundAmount += itemRefundAmount;
    }

    // Validate total refund amount does not exceed order total
    if (totalRefundAmount > parseFloat(order.total)) {
      throw new ValidationError('Total refund amount cannot exceed order total');
    }

    // Round to 2 decimal places
    totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;

    // Generate unique return number
    const returnNumber = generateReturnNumber();

    // Create return request
    const returnResult = await client.query(
      'INSERT INTO return_requests (' +
        'return_number, order_id, user_id, status, reason, description, ' +
        'refund_amount, refund_method, refund_status' +
      ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [
        returnNumber,
        data.orderId,
        data.userId,
        ReturnStatus.PENDING,
        data.reason,
        data.description || null,
        totalRefundAmount,
        data.refundMethod || null,
        RefundStatus.PENDING,
      ]
    );

    const returnRequest = returnResult.rows[0];

    // Create return items
    for (const item of data.items) {
      const itemResult = await client.query(
        'SELECT total, quantity FROM order_items WHERE id = $1',
        [item.orderItemId]
      );
      const orderItem = itemResult.rows[0];
      const itemRefundAmount = Math.round(
        (parseFloat(orderItem.total) / orderItem.quantity) * item.quantity * 100
      ) / 100;

      await client.query(
        'INSERT INTO return_items (' +
          'return_request_id, order_item_id, quantity, reason, condition, ' +
          'refund_amount, status' +
        ') VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          returnRequest.id,
          item.orderItemId,
          item.quantity,
          item.reason,
          item.condition || null,
          itemRefundAmount,
          'pending',
        ]
      );
    }

    await client.query('COMMIT');

    logger.info('Return request created', {
      returnId: returnRequest.id,
      returnNumber,
      orderId: data.orderId,
      userId: data.userId,
      refundAmount: totalRefundAmount,
    });

    return mapReturnRequest(returnRequest);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating return request', { error, data });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get return request by ID
 */
export async function getReturnRequestById(id: string): Promise<ReturnRequest> {
  const result = await db.query(
    `SELECT rr.*,
      json_build_object(
        'id', o.id,
        'orderNumber', o.order_number,
        'total', o.total
      ) as "order"
    FROM return_requests rr
    LEFT JOIN orders o ON rr.order_id = o.id
    WHERE rr.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Return request not found');
  }

  const returnRequest = result.rows[0];

  // Get return items
  const itemsResult = await db.query(
    'SELECT * FROM return_items WHERE return_request_id = $1',
    [id]
  );

  returnRequest.items = itemsResult.rows.map(mapReturnItem);

  return mapReturnRequest(returnRequest);
}

/**
 * List return requests with filters and pagination
 */
export async function listReturnRequests(
  query: ReturnListQuery
): Promise<{ items: ReturnRequest[]; total: number; page: number; limit: number }> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const sortBy = query.sortBy || 'requestedAt';
  const sortOrder = query.sortOrder || 'desc';

  // Build WHERE clause with proper $N parameterization
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (query.filters?.status) {
    const statuses = Array.isArray(query.filters.status)
      ? query.filters.status
      : (query.filters.status as string).split(',');
    conditions.push(`rr.status = ANY($${paramIndex})`);
    params.push(statuses);
    paramIndex++;
  }

  if (query.filters?.userId) {
    conditions.push(`rr.user_id = $${paramIndex}`);
    params.push(query.filters.userId);
    paramIndex++;
  }

  if (query.filters?.orderId) {
    conditions.push(`rr.order_id = $${paramIndex}`);
    params.push(query.filters.orderId);
    paramIndex++;
  }

  if (query.filters?.returnNumber) {
    conditions.push(`rr.return_number ILIKE $${paramIndex}`);
    params.push('%' + query.filters.returnNumber + '%');
    paramIndex++;
  }

  if (query.filters?.startDate) {
    conditions.push(`rr.requested_at >= $${paramIndex}`);
    params.push(query.filters.startDate);
    paramIndex++;
  }

  if (query.filters?.endDate) {
    conditions.push(`rr.requested_at <= $${paramIndex}`);
    params.push(query.filters.endDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Map sortBy to column name (whitelist to prevent SQL injection)
  const sortColumnMap: Record<string, string> = {
    requestedAt: 'rr.requested_at',
    refundAmount: 'rr.refund_amount',
    status: 'rr.status',
  };
  const sortColumn = sortColumnMap[sortBy] || 'rr.requested_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM return_requests rr ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results
  const result = await db.query(
    `SELECT rr.*,
      json_build_object(
        'id', o.id,
        'orderNumber', o.order_number,
        'total', o.total
      ) as "order"
    FROM return_requests rr
    LEFT JOIN orders o ON rr.order_id = o.id
    ${whereClause}
    ORDER BY ${sortColumn} ${safeSortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const items = result.rows.map(mapReturnRequest);

  return {
    items,
    total,
    page,
    limit,
  };
}

/**
 * Update return request status with validation of status transitions.
 * Implements the flow: pending → approved → refunding → completed / rejected
 */
export async function updateReturnRequestStatus(
  id: string,
  newStatus: ReturnStatus,
  adminNotes?: string,
  refundAmount?: number
): Promise<ReturnRequest> {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Get current return request with row lock
    const result = await client.query(
      'SELECT * FROM return_requests WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Return request not found');
    }

    const returnRequest = result.rows[0];
    const currentStatus = returnRequest.status as ReturnStatus;

    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions: ${allowedTransitions?.join(', ') || 'none'}`
      );
    }

    // Build update fields based on the new status
    const updateFields: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams: any[] = [newStatus];
    let paramIdx = 2;

    // Add admin notes if provided
    if (adminNotes !== undefined) {
      updateFields.push(`admin_notes = $${paramIdx}`);
      updateParams.push(adminNotes);
      paramIdx++;
    }

    // Handle status-specific logic
    switch (newStatus) {
      case ReturnStatus.APPROVED: {
        updateFields.push('approved_at = CURRENT_TIMESTAMP');
        // Calculate or use provided refund amount
        if (refundAmount !== undefined && refundAmount > 0) {
          // Validate refund amount doesn't exceed original request amount
          const originalAmount = parseFloat(returnRequest.refund_amount);
          if (refundAmount > originalAmount) {
            throw new ValidationError(
              `Refund amount (${refundAmount}) cannot exceed original amount (${originalAmount})`
            );
          }
          updateFields.push(`refund_amount = $${paramIdx}`);
          updateParams.push(refundAmount);
          paramIdx++;
        }
        break;
      }

      case ReturnStatus.REJECTED:
        updateFields.push('rejected_at = CURRENT_TIMESTAMP');
        updateFields.push(`refund_status = $${paramIdx}`);
        updateParams.push(RefundStatus.FAILED);
        paramIdx++;
        break;

      case ReturnStatus.REFUNDING:
        updateFields.push(`refund_status = $${paramIdx}`);
        updateParams.push(RefundStatus.PROCESSING);
        paramIdx++;
        break;

      case ReturnStatus.COMPLETED:
        updateFields.push('completed_at = CURRENT_TIMESTAMP');
        updateFields.push(`refund_status = $${paramIdx}`);
        updateParams.push(RefundStatus.COMPLETED);
        paramIdx++;
        break;

      case ReturnStatus.CANCELLED:
        // No additional fields needed
        break;
    }

    // Execute update
    updateParams.push(id);
    const updateResult = await client.query(
      `UPDATE return_requests SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      updateParams
    );

    // Update return items status based on the new return status
    const itemStatusMap: Record<string, string> = {
      [ReturnStatus.APPROVED]: 'approved',
      [ReturnStatus.REJECTED]: 'rejected',
      [ReturnStatus.REFUNDING]: 'refunding',
      [ReturnStatus.COMPLETED]: 'refunded',
      [ReturnStatus.CANCELLED]: 'cancelled',
    };

    const newItemStatus = itemStatusMap[newStatus];
    if (newItemStatus) {
      await client.query(
        'UPDATE return_items SET status = $1 WHERE return_request_id = $2',
        [newItemStatus, id]
      );
    }

    // When completing a return, update the order payment status
    if (newStatus === ReturnStatus.COMPLETED) {
      await client.query(
        "UPDATE orders SET payment_status = 'refunded' WHERE id = $1",
        [returnRequest.order_id]
      );
    }

    await client.query('COMMIT');

    logger.info('Return request status updated', {
      returnId: id,
      returnNumber: returnRequest.return_number,
      previousStatus: currentStatus,
      newStatus,
      refundAmount: refundAmount || parseFloat(returnRequest.refund_amount),
    });

    return mapReturnRequest(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating return request status', { error, returnId: id, newStatus });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate refund amount for a return request.
 * Computes proportional refund based on returned items and quantities.
 */
export async function calculateRefundAmount(
  orderId: string,
  items: Array<{ orderItemId: string; quantity: number }>
): Promise<{ totalRefund: number; itemRefunds: Array<{ orderItemId: string; refundAmount: number }> }> {
  const itemRefunds: Array<{ orderItemId: string; refundAmount: number }> = [];
  let totalRefund = 0;

  for (const item of items) {
    const result = await db.query(
      'SELECT id, total, quantity FROM order_items WHERE id = $1 AND order_id = $2',
      [item.orderItemId, orderId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Order item ' + item.orderItemId + ' not found');
    }

    const orderItem = result.rows[0];

    if (item.quantity > orderItem.quantity) {
      throw new ValidationError(
        `Return quantity (${item.quantity}) exceeds order quantity (${orderItem.quantity})`
      );
    }

    // Proportional refund calculation
    const unitPrice = parseFloat(orderItem.total) / orderItem.quantity;
    const refundAmount = Math.round(unitPrice * item.quantity * 100) / 100;

    itemRefunds.push({ orderItemId: item.orderItemId, refundAmount });
    totalRefund += refundAmount;
  }

  // Round total to 2 decimal places
  totalRefund = Math.round(totalRefund * 100) / 100;

  return { totalRefund, itemRefunds };
}

/**
 * Approve a return request
 */
export async function approveReturnRequest(
  id: string,
  adminNotes?: string
): Promise<ReturnRequest> {
  return updateReturnRequestStatus(id, ReturnStatus.APPROVED, adminNotes);
}

/**
 * Reject a return request
 */
export async function rejectReturnRequest(
  id: string,
  adminNotes?: string
): Promise<ReturnRequest> {
  return updateReturnRequestStatus(id, ReturnStatus.REJECTED, adminNotes);
}

/**
 * Complete a return request (mark as completed and process refund)
 */
export async function completeReturnRequest(
  id: string,
  adminNotes?: string
): Promise<ReturnRequest> {
  return updateReturnRequestStatus(id, ReturnStatus.COMPLETED, adminNotes);
}

/**
 * Cancel a return request
 */
export async function cancelReturnRequest(id: string): Promise<ReturnRequest> {
  return updateReturnRequestStatus(id, ReturnStatus.CANCELLED);
}

/**
 * Map database row to ReturnRequest type
 */
function mapReturnRequest(row: any): ReturnRequest {
  return {
    id: row.id,
    returnNumber: row.return_number,
    orderId: row.order_id,
    userId: row.user_id,
    status: row.status,
    reason: row.reason,
    description: row.description,
    refundAmount: parseFloat(row.refund_amount),
    refundMethod: row.refund_method,
    refundStatus: row.refund_status,
    adminNotes: row.admin_notes,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    order: row.order,
    items: row.items,
  };
}

/**
 * Map database row to ReturnItem type
 */
function mapReturnItem(row: any): ReturnItem {
  return {
    id: row.id,
    returnRequestId: row.return_request_id,
    orderItemId: row.order_item_id,
    quantity: row.quantity,
    reason: row.reason,
    condition: row.condition,
    refundAmount: parseFloat(row.refund_amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
