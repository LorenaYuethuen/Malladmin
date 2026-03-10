/**
 * Shipping Controller
 * 
 * Handles shipping and logistics tracking operations.
 * Supports tracking assignment, status updates, and carrier integration.
 * 
 * Requirements: 2.3, 2.9, 16.2, 16.3, 8.8
 */

import { Request, Response } from 'express';
import db from '../database/connection';
import {
  assignTrackingSchema,
} from '../validation/shippingSchemas';
import {
  TrackingStatus,
} from '../types/shipping';
import { ErrorCode, ApiResponse } from '../types';
import logger from '../utils/logger';

/**
 * Assign tracking number to an order
 * POST /api/v1/shipping/assign
 */
export async function assignTracking(req: Request, res: Response): Promise<void> {
  const client = await db.getClient();

  try {
    // Validate request body
    const validatedData = assignTrackingSchema.parse(req.body);
    const { orderId, trackingNumber, carrier, shippingMethod, estimatedDeliveryDate } =
      validatedData;

    logger.info('Assigning tracking number', {
      orderId,
      trackingNumber,
      carrier,
      requestId: req.headers['x-request-id'],
    });

    await client.query('BEGIN');

    // Check if order exists and is in valid status
    const orderResult = await client.query(
      'SELECT id, status FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Order not found',
        },
      } as ApiResponse<null>);
      return;
    }

    const order = orderResult.rows[0];
    if (!['paid', 'processing', 'confirmed'].includes(order.status)) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Cannot assign tracking to order in status: ${order.status}`,
        },
      } as ApiResponse<null>);
      return;
    }

    // Check if tracking number already exists
    const existingTracking = await client.query(
      'SELECT id FROM order_tracking WHERE tracking_number = $1',
      [trackingNumber]
    );

    if (existingTracking.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Tracking number already exists',
        },
      } as ApiResponse<null>);
      return;
    }

    // Create tracking record
    const trackingResult = await client.query(
      `INSERT INTO order_tracking 
       (order_id, tracking_number, carrier, shipping_method, status, estimated_delivery_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orderId, trackingNumber, carrier, shippingMethod, TrackingStatus.PENDING, estimatedDeliveryDate]
    );

    // Update order status to shipped
    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['shipped', orderId]
    );

    await client.query('COMMIT');

    logger.info('Tracking number assigned successfully', {
      orderId,
      trackingNumber,
      requestId: req.headers['x-request-id'],
    });

    res.status(201).json({
      success: true,
      data: trackingResult.rows[0],
    } as ApiResponse<any>);
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Error assigning tracking number', {
      error: error.message,
      stack: error.stack,
      requestId: req.headers['x-request-id'],
    });

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to assign tracking number',
      },
    } as ApiResponse<null>);
  } finally {
    client.release();
  }
}

/**
 * Get tracking information for an order
 * GET /api/v1/shipping/track/:orderId
 */
export async function getTracking(req: Request, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;

    const result = await db.query(
      `SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Tracking information not found',
        },
      } as ApiResponse<null>);
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    } as ApiResponse<any>);
  } catch (error: any) {
    logger.error('Error fetching tracking information', {
      error: error.message,
      requestId: req.headers['x-request-id'],
    });

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to fetch tracking information',
      },
    } as ApiResponse<null>);
  }
}
