/**
 * Inventory Service
 * 
 * Business logic for inventory management with Redis distributed locks,
 * stock reservation tracking, and automatic expiration cleanup.
 */

import { v4 as uuidv4 } from 'uuid';
import pool from '../database/connection';
import redis from '../database/redis';
import {
  ProductInventory,
  ReserveInventoryRequest,
  DeductInventoryRequest,
  ReleaseInventoryRequest,
  UpdateInventoryRequest,
  InventoryOperationResult,
  BulkInventoryOperationResult,
  InventoryCheckResult,
  LowStockAlert,
  StockReservationStatus,
  StockReservation,
} from '../types/inventory';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

/** Reservation expiry time in milliseconds (15 minutes) */
const RESERVATION_EXPIRY_MS = 15 * 60 * 1000;

/** Redis lock TTL in seconds */
const LOCK_TTL_SECONDS = 5;

/** Redis lock key prefix */
const LOCK_PREFIX = 'lock:inventory:';

/** Cleanup interval handle */
let cleanupIntervalHandle: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Redis Distributed Lock
// ---------------------------------------------------------------------------

/**
 * Acquire a Redis distributed lock for a product.
 * Uses SET NX EX for atomic lock acquisition.
 * Returns the lock ID on success, null on failure.
 */
async function acquireLock(productId: string, ttl: number = LOCK_TTL_SECONDS): Promise<string | null> {
  const lockKey = `${LOCK_PREFIX}${productId}`;
  const lockId = uuidv4();

  try {
    const client = redis.getClient();
    const result = await client.set(lockKey, lockId, { EX: ttl, NX: true });
    return result === 'OK' ? lockId : null;
  } catch (error) {
    logger.error('Failed to acquire Redis lock', { productId, error });
    return null;
  }
}

/**
 * Release a Redis distributed lock using Lua script for atomicity.
 * Only releases if the lock is still held by the same owner.
 */
async function releaseLock(productId: string, lockId: string): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}${productId}`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const client = redis.getClient();
    const result = await client.eval(script, { keys: [lockKey], arguments: [lockId] });
    return result === 1;
  } catch (error) {
    logger.error('Failed to release Redis lock', { productId, lockId, error });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core Inventory Operations
// ---------------------------------------------------------------------------

/**
 * Get inventory for a product
 */
export async function getInventoryByProductId(productId: string): Promise<ProductInventory> {
  const result = await pool.query(
    'SELECT * FROM product_inventory WHERE product_id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Inventory not found for this product');
  }

  return mapInventory(result.rows[0]);
}

/**
 * Reserve inventory for pending orders using Redis distributed lock.
 * 
 * For each item:
 * 1. Acquire a Redis distributed lock on the product
 * 2. Check available stock (quantity - reserved_quantity)
 * 3. Increase reserved_quantity in product_inventory
 * 4. Create a stock_reservations record with 15-min expiry
 * 5. Release the lock
 * 
 * If any item fails, the entire transaction is rolled back.
 */
export async function reserveInventory(
  data: ReserveInventoryRequest
): Promise<BulkInventoryOperationResult> {
  const client = await pool.getClient();
  const results: InventoryOperationResult[] = [];
  const failedItems: Array<{ productId: string; reason: string }> = [];
  const acquiredLocks: Array<{ productId: string; lockId: string }> = [];

  try {
    // Acquire locks for all products first
    for (const item of data.items) {
      const lockId = await acquireLock(item.productId);
      if (!lockId) {
        // Release any locks we already acquired
        for (const lock of acquiredLocks) {
          await releaseLock(lock.productId, lock.lockId);
        }
        return {
          success: false,
          results: [],
          failedItems: [{
            productId: item.productId,
            reason: 'ERR_2011: Failed to acquire inventory lock. Please retry.',
          }],
        };
      }
      acquiredLocks.push({ productId: item.productId, lockId });
    }

    await client.query('BEGIN');

    const expiresAt = new Date(Date.now() + RESERVATION_EXPIRY_MS);

    for (const item of data.items) {
      try {
        // Lock the row for update to prevent race conditions
        const inventoryResult = await client.query(
          `SELECT * FROM product_inventory 
           WHERE product_id = $1 
           FOR UPDATE`,
          [item.productId]
        );

        if (inventoryResult.rows.length === 0) {
          failedItems.push({
            productId: item.productId,
            reason: 'Product inventory not found',
          });
          continue;
        }

        const inventory = inventoryResult.rows[0];
        const availableQuantity = inventory.quantity - inventory.reserved_quantity;

        // Check if enough inventory is available
        if (availableQuantity < item.quantity) {
          failedItems.push({
            productId: item.productId,
            reason: `ERR_2003: Insufficient stock. Available: ${availableQuantity}, Requested: ${item.quantity}`,
          });
          continue;
        }

        // Reserve inventory (increase reserved_quantity)
        const updateResult = await client.query(
          `UPDATE product_inventory 
           SET reserved_quantity = reserved_quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $2
           RETURNING *`,
          [item.quantity, item.productId]
        );

        // Create stock reservation record
        await client.query(
          `INSERT INTO stock_reservations (product_id, order_id, quantity, status, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [item.productId, data.orderId || null, item.quantity, StockReservationStatus.RESERVED, expiresAt]
        );

        const updated = updateResult.rows[0];

        results.push({
          success: true,
          productId: item.productId,
          previousQuantity: inventory.quantity,
          newQuantity: updated.quantity,
          previousReserved: inventory.reserved_quantity,
          newReserved: updated.reserved_quantity,
          availableQuantity: updated.available_quantity,
          message: `Reserved ${item.quantity} units`,
        });

        logger.info('Inventory reserved', {
          productId: item.productId,
          quantity: item.quantity,
          orderId: data.orderId,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error) {
        failedItems.push({
          productId: item.productId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // If any items failed, rollback the entire transaction
    if (failedItems.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, results, failedItems };
    }

    await client.query('COMMIT');
    return { success: true, results };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error reserving inventory', { error, data });
    throw error;
  } finally {
    client.release();
    // Always release all locks
    for (const lock of acquiredLocks) {
      await releaseLock(lock.productId, lock.lockId);
    }
  }
}

/**
 * Confirm (deduct) inventory when an order is paid.
 * 
 * Updates stock_reservations status from 'reserved' → 'confirmed'
 * and decreases both quantity and reserved_quantity in product_inventory.
 */
export async function deductInventory(
  data: DeductInventoryRequest
): Promise<BulkInventoryOperationResult> {
  const client = await pool.getClient();
  const results: InventoryOperationResult[] = [];
  const failedItems: Array<{ productId: string; reason: string }> = [];

  try {
    await client.query('BEGIN');

    for (const item of data.items) {
      try {
        // Lock the row for update
        const inventoryResult = await client.query(
          `SELECT * FROM product_inventory 
           WHERE product_id = $1 
           FOR UPDATE`,
          [item.productId]
        );

        if (inventoryResult.rows.length === 0) {
          failedItems.push({
            productId: item.productId,
            reason: 'Product inventory not found',
          });
          continue;
        }

        const inventory = inventoryResult.rows[0];

        // Check if enough reserved inventory exists
        if (inventory.reserved_quantity < item.quantity) {
          failedItems.push({
            productId: item.productId,
            reason: `ERR_2012: Insufficient reserved inventory. Reserved: ${inventory.reserved_quantity}, Requested: ${item.quantity}`,
          });
          continue;
        }

        // Deduct inventory (decrease both quantity and reserved_quantity)
        const updateResult = await client.query(
          `UPDATE product_inventory 
           SET quantity = quantity - $1,
               reserved_quantity = reserved_quantity - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $2
           RETURNING *`,
          [item.quantity, item.productId]
        );

        // Update reservation status to confirmed
        if (data.orderId) {
          await client.query(
            `UPDATE stock_reservations 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $2 AND product_id = $3 AND status = $4`,
            [StockReservationStatus.CONFIRMED, data.orderId, item.productId, StockReservationStatus.RESERVED]
          );
        }

        const updated = updateResult.rows[0];

        results.push({
          success: true,
          productId: item.productId,
          previousQuantity: inventory.quantity,
          newQuantity: updated.quantity,
          previousReserved: inventory.reserved_quantity,
          newReserved: updated.reserved_quantity,
          availableQuantity: updated.available_quantity,
          message: `Deducted ${item.quantity} units`,
        });

        logger.info('Inventory deducted', {
          productId: item.productId,
          quantity: item.quantity,
          orderId: data.orderId,
        });
      } catch (error) {
        failedItems.push({
          productId: item.productId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (failedItems.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, results, failedItems };
    }

    await client.query('COMMIT');
    return { success: true, results };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deducting inventory', { error, data });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Release reserved inventory when an order is cancelled or times out.
 * 
 * Decreases reserved_quantity in product_inventory (restoring availability)
 * and updates stock_reservations status to 'released'.
 */
export async function releaseInventory(
  data: ReleaseInventoryRequest
): Promise<BulkInventoryOperationResult> {
  const client = await pool.getClient();
  const results: InventoryOperationResult[] = [];
  const failedItems: Array<{ productId: string; reason: string }> = [];

  try {
    await client.query('BEGIN');

    for (const item of data.items) {
      try {
        // Lock the row for update
        const inventoryResult = await client.query(
          `SELECT * FROM product_inventory 
           WHERE product_id = $1 
           FOR UPDATE`,
          [item.productId]
        );

        if (inventoryResult.rows.length === 0) {
          failedItems.push({
            productId: item.productId,
            reason: 'Product inventory not found',
          });
          continue;
        }

        const inventory = inventoryResult.rows[0];

        // Check if enough reserved inventory exists
        if (inventory.reserved_quantity < item.quantity) {
          failedItems.push({
            productId: item.productId,
            reason: `ERR_2013: Insufficient reserved inventory to release. Reserved: ${inventory.reserved_quantity}, Requested: ${item.quantity}`,
          });
          continue;
        }

        // Release inventory (decrease reserved_quantity only)
        const updateResult = await client.query(
          `UPDATE product_inventory 
           SET reserved_quantity = reserved_quantity - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $2
           RETURNING *`,
          [item.quantity, item.productId]
        );

        // Update reservation status to released
        if (data.orderId) {
          await client.query(
            `UPDATE stock_reservations 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE order_id = $2 AND product_id = $3 AND status = $4`,
            [StockReservationStatus.RELEASED, data.orderId, item.productId, StockReservationStatus.RESERVED]
          );
        }

        const updated = updateResult.rows[0];

        results.push({
          success: true,
          productId: item.productId,
          previousQuantity: inventory.quantity,
          newQuantity: updated.quantity,
          previousReserved: inventory.reserved_quantity,
          newReserved: updated.reserved_quantity,
          availableQuantity: updated.available_quantity,
          message: `Released ${item.quantity} units`,
        });

        logger.info('Inventory released', {
          productId: item.productId,
          quantity: item.quantity,
          orderId: data.orderId,
        });
      } catch (error) {
        failedItems.push({
          productId: item.productId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (failedItems.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, results, failedItems };
    }

    await client.query('COMMIT');
    return { success: true, results };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error releasing inventory', { error, data });
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Reservation Timeout Cleanup
// ---------------------------------------------------------------------------

/**
 * Clean up expired stock reservations.
 * 
 * Finds all reservations with status='reserved' that have passed their expires_at,
 * restores the reserved_quantity in product_inventory, and marks them as 'released'.
 * 
 * Runs every minute via setInterval, cleaning reservations older than 15 minutes.
 */
export async function cleanupExpiredReservations(): Promise<number> {
  const client = await pool.getClient();
  let cleanedCount = 0;

  try {
    await client.query('BEGIN');

    // Find all expired reservations that are still in 'reserved' status
    const expiredResult = await client.query(
      `SELECT id, product_id, order_id, quantity
       FROM stock_reservations
       WHERE status = $1 AND expires_at < NOW()
       FOR UPDATE`,
      [StockReservationStatus.RESERVED]
    );

    if (expiredResult.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    for (const reservation of expiredResult.rows) {
      // Restore reserved_quantity in product_inventory
      await client.query(
        `UPDATE product_inventory
         SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2`,
        [reservation.quantity, reservation.product_id]
      );

      // Mark reservation as released
      await client.query(
        `UPDATE stock_reservations
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [StockReservationStatus.RELEASED, reservation.id]
      );

      cleanedCount++;

      logger.info('Expired reservation cleaned up', {
        reservationId: reservation.id,
        productId: reservation.product_id,
        orderId: reservation.order_id,
        quantity: reservation.quantity,
      });
    }

    await client.query('COMMIT');

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired stock reservations`);
    }

    return cleanedCount;
  } catch (error: any) {
    await client.query('ROLLBACK');
    // Suppress "relation does not exist" errors (42P01) — table may not be migrated yet
    if (error?.code === '42P01') {
      // Log once at debug level instead of spamming errors every minute
      logger.debug('stock_reservations or product_inventory table not found — skipping cleanup. Run migrations to create the table.');
    } else {
      logger.error('Error cleaning up expired reservations', { error });
    }
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Start the reservation cleanup task.
 * Runs every 60 seconds (1 minute).
 */
export function startReservationCleanupTask(): void {
  if (cleanupIntervalHandle) {
    logger.warn('Reservation cleanup task is already running');
    return;
  }

  // Run immediately on start
  cleanupExpiredReservations().catch((err) => {
    logger.error('Initial reservation cleanup failed', { error: err });
  });

  // Then run every minute
  cleanupIntervalHandle = setInterval(() => {
    cleanupExpiredReservations().catch((err) => {
      logger.error('Scheduled reservation cleanup failed', { error: err });
    });
  }, 60 * 1000);

  logger.info('Reservation cleanup task started (interval: 60s, expiry: 15min)');
}

/**
 * Stop the reservation cleanup task.
 */
export function stopReservationCleanupTask(): void {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
    logger.info('Reservation cleanup task stopped');
  }
}

// ---------------------------------------------------------------------------
// Utility Operations
// ---------------------------------------------------------------------------

/**
 * Update inventory quantity (restock)
 */
export async function updateInventory(
  productId: string,
  data: UpdateInventoryRequest
): Promise<ProductInventory> {
  const result = await pool.query(
    `UPDATE product_inventory 
     SET quantity = $1,
         low_stock_threshold = COALESCE($2, low_stock_threshold),
         last_restocked_at = CASE WHEN $1 > quantity THEN CURRENT_TIMESTAMP ELSE last_restocked_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $3
     RETURNING *`,
    [data.quantity, data.lowStockThreshold, productId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Inventory not found for this product');
  }

  logger.info('Inventory updated', {
    productId,
    quantity: data.quantity,
    lowStockThreshold: data.lowStockThreshold,
  });

  return mapInventory(result.rows[0]);
}

/**
 * Check inventory availability for multiple products
 */
export async function checkInventoryAvailability(
  items: Array<{ productId: string; quantity: number }>
): Promise<InventoryCheckResult[]> {
  const results: InventoryCheckResult[] = [];

  for (const item of items) {
    const inventoryResult = await pool.query(
      'SELECT * FROM product_inventory WHERE product_id = $1',
      [item.productId]
    );

    if (inventoryResult.rows.length === 0) {
      results.push({
        productId: item.productId,
        available: false,
        availableQuantity: 0,
        requestedQuantity: item.quantity,
        isInStock: false,
        isLowStock: false,
      });
      continue;
    }

    const inventory = inventoryResult.rows[0];
    const availableQuantity = inventory.available_quantity;

    results.push({
      productId: item.productId,
      available: availableQuantity >= item.quantity,
      availableQuantity,
      requestedQuantity: item.quantity,
      isInStock: inventory.is_in_stock,
      isLowStock: inventory.is_low_stock,
    });
  }

  return results;
}

/**
 * Get low stock alerts
 */
export async function getLowStockAlerts(limit: number = 50): Promise<LowStockAlert[]> {
  const result = await pool.query(
    `SELECT 
      pi.product_id,
      p.name as product_name,
      pi.available_quantity,
      pi.low_stock_threshold,
      (pi.available_quantity = 0) as is_out_of_stock
     FROM product_inventory pi
     JOIN products p ON pi.product_id = p.id
     WHERE pi.is_low_stock = TRUE OR pi.is_in_stock = FALSE
     ORDER BY pi.available_quantity ASC, p.name ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    availableQuantity: row.available_quantity,
    lowStockThreshold: row.low_stock_threshold,
    isOutOfStock: row.is_out_of_stock,
  }));
}

/**
 * Map database row to ProductInventory type
 */
function mapInventory(row: any): ProductInventory {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity,
    availableQuantity: row.available_quantity,
    lowStockThreshold: row.low_stock_threshold,
    isInStock: row.is_in_stock,
    isLowStock: row.is_low_stock,
    lastRestockedAt: row.last_restocked_at,
    updatedAt: row.updated_at,
  };
}
