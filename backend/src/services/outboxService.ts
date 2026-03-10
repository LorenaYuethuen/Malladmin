/**
 * Outbox Service
 * 
 * Implements the Transactional Outbox pattern for reliable event publishing.
 * Events are written to the outbox table in the same transaction as business data,
 * ensuring consistency between data changes and event publishing.
 */

import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  OutboxEvent,
  CreateOutboxEventData,
  OutboxEventFilter,
} from '../types/outbox';
import db from '../database/connection';
import logger from '../utils/logger';

class OutboxService {
  /**
   * Write an event to the outbox table within a transaction
   * This method should be called within the same transaction as the business operation
   */
  async writeEvent(
    client: PoolClient,
    eventData: CreateOutboxEventData
  ): Promise<string> {
    const eventId = uuidv4();

    try {
      const query = `
        INSERT INTO outbox_events (
          id,
          aggregate_type,
          aggregate_id,
          event_type,
          payload,
          created_at,
          processed,
          retry_count
        ) VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, 0)
        RETURNING id
      `;

      const values = [
        eventId,
        eventData.aggregateType,
        eventData.aggregateId,
        eventData.eventType,
        JSON.stringify(eventData.payload),
      ];

      await client.query(query, values);

      logger.debug('Outbox event written', {
        eventId,
        aggregateType: eventData.aggregateType,
        eventType: eventData.eventType,
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to write outbox event', {
        error,
        eventData,
      });
      throw error;
    }
  }

  /**
   * Get unprocessed events for processing
   */
  async getUnprocessedEvents(limit: number = 100): Promise<OutboxEvent[]> {
    try {
      const query = `
        SELECT 
          id,
          aggregate_type as "aggregateType",
          aggregate_id as "aggregateId",
          event_type as "eventType",
          payload,
          created_at as "createdAt",
          processed_at as "processedAt",
          processed,
          retry_count as "retryCount",
          last_error as "lastError",
          version
        FROM outbox_events
        WHERE processed = FALSE
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await db.query(query, [limit]);

      return result.rows.map((row) => ({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      }));
    } catch (error) {
      logger.error('Failed to get unprocessed events', { error });
      throw error;
    }
  }

  /**
   * Mark an event as processed
   */
  async markAsProcessed(eventId: string): Promise<void> {
    try {
      const query = `
        UPDATE outbox_events
        SET 
          processed = TRUE,
          processed_at = NOW()
        WHERE id = $1
      `;

      await db.query(query, [eventId]);

      logger.debug('Event marked as processed', { eventId });
    } catch (error) {
      logger.error('Failed to mark event as processed', { error, eventId });
      throw error;
    }
  }

  /**
   * Mark an event as failed and increment retry count
   */
  async markAsFailed(eventId: string, errorMessage: string): Promise<void> {
    try {
      const query = `
        UPDATE outbox_events
        SET 
          retry_count = retry_count + 1,
          last_error = $2
        WHERE id = $1
      `;

      await db.query(query, [eventId, errorMessage]);

      logger.warn('Event marked as failed', { eventId, errorMessage });
    } catch (error) {
      logger.error('Failed to mark event as failed', { error, eventId });
      throw error;
    }
  }

  /**
   * Get events by filter criteria
   */
  async getEvents(filter: OutboxEventFilter = {}): Promise<OutboxEvent[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filter.processed !== undefined) {
        paramCount++;
        conditions.push(`processed = $${paramCount}`);
        values.push(filter.processed);
      }

      if (filter.aggregateType) {
        paramCount++;
        conditions.push(`aggregate_type = $${paramCount}`);
        values.push(filter.aggregateType);
      }

      if (filter.eventType) {
        paramCount++;
        conditions.push(`event_type = $${paramCount}`);
        values.push(filter.eventType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter.limit || 100;

      const query = `
        SELECT 
          id,
          aggregate_type as "aggregateType",
          aggregate_id as "aggregateId",
          event_type as "eventType",
          payload,
          created_at as "createdAt",
          processed_at as "processedAt",
          processed,
          retry_count as "retryCount",
          last_error as "lastError",
          version
        FROM outbox_events
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const result = await db.query(query, values);

      return result.rows.map((row) => ({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      }));
    } catch (error) {
      logger.error('Failed to get events', { error, filter });
      throw error;
    }
  }

  /**
   * Delete old processed events (cleanup)
   * Should be called periodically to prevent table bloat
   */
  async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM outbox_events
        WHERE processed = TRUE
          AND processed_at < NOW() - INTERVAL '${daysOld} days'
      `;

      const result = await db.query(query);
      const deletedCount = result.rowCount || 0;

      logger.info('Cleaned up old outbox events', { deletedCount, daysOld });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old events', { error, daysOld });
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getStatistics(): Promise<{
    total: number;
    processed: number;
    pending: number;
    failed: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE processed = TRUE) as processed,
          COUNT(*) FILTER (WHERE processed = FALSE AND retry_count = 0) as pending,
          COUNT(*) FILTER (WHERE processed = FALSE AND retry_count > 0) as failed
        FROM outbox_events
      `;

      const result = await db.query(query);
      const stats = result.rows[0];

      return {
        total: parseInt(stats.total),
        processed: parseInt(stats.processed),
        pending: parseInt(stats.pending),
        failed: parseInt(stats.failed),
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error });
      throw error;
    }
  }
}

export const outboxService = new OutboxService();
export default outboxService;
