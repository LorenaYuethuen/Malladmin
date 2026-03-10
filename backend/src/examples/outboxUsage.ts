/**
 * Transactional Outbox Pattern - Usage Examples
 * 
 * This file demonstrates how to use the Transactional Outbox pattern
 * in your application to ensure reliable event publishing.
 */

import db from '../database/connection';
import { outboxService } from '../services/outboxService';
import { eventPublisher } from '../services/eventPublisher';
import { outboxProcessor } from '../services/outboxProcessor';

/**
 * Example 1: Creating an order with outbox event
 * 
 * This example shows how to write business data and an outbox event
 * in the same transaction to ensure consistency.
 */
export async function createOrderWithEvent(orderData: any) {
  return await db.transaction(async (client) => {
    // 1. Insert order into database
    const orderQuery = `
      INSERT INTO orders (id, customer_id, total_amount, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const orderResult = await client.query(orderQuery, [
      orderData.id,
      orderData.customerId,
      orderData.totalAmount,
      'pending',
    ]);
    const order = orderResult.rows[0];

    // 2. Write event to outbox in the same transaction
    await outboxService.writeEvent(client, {
      aggregateType: 'order',
      aggregateId: order.id,
      eventType: 'ORDER_CREATED',
      payload: {
        orderId: order.id,
        customerId: order.customer_id,
        totalAmount: order.total_amount,
        status: order.status,
        createdAt: new Date().toISOString(),
      },
    });

    // 3. Transaction commits - both order and event are saved atomically
    return order;
  });
}

/**
 * Example 2: Updating product with multiple events
 */
export async function updateProductWithEvents(productId: string, updates: any) {
  return await db.transaction(async (client) => {
    // Update product
    const updateQuery = `
      UPDATE products
      SET name = $1, price = $2, stock = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const result = await client.query(updateQuery, [
      updates.name,
      updates.price,
      updates.stock,
      productId,
    ]);
    const product = result.rows[0];

    // Write product updated event
    await outboxService.writeEvent(client, {
      aggregateType: 'product',
      aggregateId: productId,
      eventType: 'PRODUCT_UPDATED',
      payload: {
        productId,
        changes: updates,
        updatedAt: new Date().toISOString(),
      },
    });

    // If stock is low, write additional event
    if (product.stock < 10) {
      await outboxService.writeEvent(client, {
        aggregateType: 'inventory',
        aggregateId: productId,
        eventType: 'INVENTORY_LOW_STOCK',
        payload: {
          productId,
          currentStock: product.stock,
          threshold: 10,
        },
      });
    }

    return product;
  });
}

/**
 * Example 3: Subscribing to events
 * 
 * This example shows how to subscribe to events and handle them.
 */
export async function setupEventHandlers() {
  // Subscribe to ORDER_CREATED events
  await eventPublisher.subscribe('ORDER_CREATED', async (event) => {
    console.log('Order created:', event);
    
    // Handle the event (e.g., send email, update inventory, etc.)
    // await sendOrderConfirmationEmail(event.payload);
    // await reserveInventory(event.payload.orderId);
  });

  // Subscribe to PRODUCT_UPDATED events
  await eventPublisher.subscribe('PRODUCT_UPDATED', async (event) => {
    console.log('Product updated:', event);
    
    // Handle the event (e.g., invalidate cache, update search index)
    // await invalidateProductCache(event.payload.productId);
    // await updateSearchIndex(event.payload.productId);
  });

  // Subscribe to INVENTORY_LOW_STOCK events
  await eventPublisher.subscribe('INVENTORY_LOW_STOCK', async (event) => {
    console.log('Low stock alert:', event);
    
    // Handle the event (e.g., send alert, trigger reorder)
    // await sendLowStockAlert(event.payload);
    // await triggerAutoReorder(event.payload.productId);
  });
}

/**
 * Example 4: Starting the outbox processor
 * 
 * This should be called when your application starts.
 */
export function startOutboxProcessor() {
  // Start the processor with default config
  outboxProcessor.start();

  // Or start with custom config
  // const customProcessor = new OutboxProcessor({
  //   pollIntervalMs: 10000, // Poll every 10 seconds
  //   batchSize: 50,
  //   maxRetries: 3,
  //   retryDelayMs: 2000,
  // });
  // customProcessor.start();
}

/**
 * Example 5: Monitoring outbox statistics
 */
export async function monitorOutbox() {
  // Get statistics
  const stats = await outboxService.getStatistics();
  console.log('Outbox statistics:', stats);

  // Get processor status
  const status = outboxProcessor.getStatus();
  console.log('Processor status:', status);

  // Get queue lengths
  const orderQueueLength = await eventPublisher.getQueueLength('ORDER_CREATED');
  console.log('ORDER_CREATED queue length:', orderQueueLength);
}

/**
 * Example 6: Manual event processing (for testing)
 */
export async function manualProcessing() {
  // Trigger manual processing
  await outboxProcessor.processNow();

  // Or get and process specific events
  const events = await outboxService.getUnprocessedEvents(10);
  console.log('Unprocessed events:', events.length);
}

/**
 * Example 7: Cleanup old events
 */
export async function cleanupOldEvents() {
  // Delete events older than 30 days
  const deletedCount = await outboxService.cleanupOldEvents(30);
  console.log('Deleted old events:', deletedCount);
}

/**
 * Example 8: Graceful shutdown
 */
export function gracefulShutdown() {
  // Stop the processor before shutting down
  outboxProcessor.stop();
  console.log('Outbox processor stopped gracefully');
}

/**
 * Example 9: Error handling and rollback
 */
export async function orderWithRollback(orderData: any) {
  try {
    return await db.transaction(async (client) => {
      // Insert order
      const orderQuery = `
        INSERT INTO orders (id, customer_id, total_amount, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const orderResult = await client.query(orderQuery, [
        orderData.id,
        orderData.customerId,
        orderData.totalAmount,
        'pending',
      ]);

      // Write outbox event
      await outboxService.writeEvent(client, {
        aggregateType: 'order',
        aggregateId: orderResult.rows[0].id,
        eventType: 'ORDER_CREATED',
        payload: orderResult.rows[0],
      });

      // If something fails here, both order and event will be rolled back
      if (orderData.totalAmount < 0) {
        throw new Error('Invalid order amount');
      }

      return orderResult.rows[0];
    });
  } catch (error) {
    console.error('Order creation failed, transaction rolled back:', error);
    throw error;
  }
}
