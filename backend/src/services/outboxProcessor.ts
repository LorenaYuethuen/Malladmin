/**
 * Outbox Processor Worker
 * 
 * Background worker that polls the outbox table for unprocessed events
 * and publishes them to the message queue. Implements retry logic with
 * exponential backoff for failed events.
 */

import { OutboxEvent, ProcessingResult } from '../types/outbox';
import { outboxService } from './outboxService';
import { eventPublisher } from './eventPublisher';
import logger from '../utils/logger';

interface ProcessorConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enabled: boolean;
}

class OutboxProcessor {
  private config: ProcessorConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProcessorConfig>) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs || 5000, // Poll every 5 seconds
      batchSize: config?.batchSize || 100,
      maxRetries: config?.maxRetries || 5,
      retryDelayMs: config?.retryDelayMs || 1000,
      enabled: config?.enabled !== undefined ? config.enabled : true,
    };
  }

  /**
   * Start the outbox processor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Outbox processor is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Outbox processor is disabled');
      return;
    }

    this.isRunning = true;
    logger.info('Starting outbox processor', {
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
    });

    // Start polling
    this.intervalId = setInterval(() => {
      this.processEvents().catch((error) => {
        logger.error('Error in outbox processor', { error });
      });
    }, this.config.pollIntervalMs);

    // Process immediately on start
    this.processEvents().catch((error) => {
      logger.error('Error in initial outbox processing', { error });
    });
  }

  /**
   * Stop the outbox processor
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Outbox processor is not running');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Outbox processor stopped');
  }

  /**
   * Process unprocessed events
   */
  private async processEvents(): Promise<void> {
    try {
      // Get unprocessed events
      const events = await outboxService.getUnprocessedEvents(
        this.config.batchSize
      );

      if (events.length === 0) {
        logger.debug('No unprocessed events found');
        return;
      }

      logger.info('Processing outbox events', { count: events.length });

      // Process each event
      const results = await Promise.allSettled(
        events.map((event) => this.processEvent(event))
      );

      // Log results
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info('Outbox processing completed', {
        total: events.length,
        successful,
        failed,
      });
    } catch (error) {
      logger.error('Failed to process outbox events', { error });
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: OutboxEvent): Promise<ProcessingResult> {
    try {
      // Check if event has exceeded max retries
      if (event.retryCount >= this.config.maxRetries) {
        logger.error('Event exceeded max retries', {
          eventId: event.id,
          retryCount: event.retryCount,
          maxRetries: this.config.maxRetries,
        });
        return {
          success: false,
          eventId: event.id,
          error: 'Max retries exceeded',
        };
      }

      // Apply exponential backoff for retries
      if (event.retryCount > 0) {
        const delay = this.calculateBackoff(event.retryCount);
        await this.sleep(delay);
      }

      // Publish the event
      await eventPublisher.publish(event);

      // Mark as processed
      await outboxService.markAsProcessed(event.id);

      logger.info('Event processed successfully', {
        eventId: event.id,
        eventType: event.eventType,
      });

      return {
        success: true,
        eventId: event.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to process event', {
        eventId: event.id,
        error: errorMessage,
        retryCount: event.retryCount,
      });

      // Mark as failed and increment retry count
      await outboxService.markAsFailed(event.id, errorMessage);

      return {
        success: false,
        eventId: event.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const baseDelay = this.config.retryDelayMs;
    const maxDelay = 60000; // Max 1 minute
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    return delay;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean;
    config: ProcessorConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  /**
   * Process events manually (for testing or manual triggers)
   */
  async processNow(): Promise<void> {
    logger.info('Manual outbox processing triggered');
    await this.processEvents();
  }
}

// Create singleton instance
export const outboxProcessor = new OutboxProcessor();
export default outboxProcessor;
