/**
 * Event Publisher Service
 * 
 * Publishes events from the outbox to external message queues or event buses.
 * In this implementation, we use Redis Pub/Sub as a simple message queue.
 * For production, this could be replaced with RabbitMQ, Kafka, or AWS SQS.
 */

import { OutboxEvent } from '../types/outbox';
import redis from '../database/redis';
import logger from '../utils/logger';

class EventPublisher {
  private readonly channelPrefix = 'events:';

  /**
   * Publish an event to the message queue
   */
  async publish(event: OutboxEvent): Promise<void> {
    try {
      const channel = this.getChannelName(event.eventType);
      const message = JSON.stringify({
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
        version: event.version,
      });

      const client = redis.getClient();

      // Publish to Redis Pub/Sub
      await client.publish(channel, message);

      // Also store in a Redis list for reliable delivery (optional)
      const listKey = `${this.channelPrefix}${event.eventType}:queue`;
      await client.rPush(listKey, message);

      // Set expiration on the list (7 days)
      await client.expire(listKey, 7 * 24 * 60 * 60);

      logger.info('Event published', {
        eventId: event.id,
        eventType: event.eventType,
        channel,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        error,
        eventId: event.id,
        eventType: event.eventType,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: OutboxEvent[]): Promise<void> {
    const promises = events.map((event) => this.publish(event));
    await Promise.all(promises);
  }

  /**
   * Get channel name for an event type
   */
  private getChannelName(eventType: string): string {
    return `${this.channelPrefix}${eventType}`;
  }

  /**
   * Subscribe to events (for consumers)
   */
  async subscribe(
    eventType: string,
    handler: (event: any) => Promise<void>
  ): Promise<void> {
    const channel = this.getChannelName(eventType);

    // Create a separate Redis client for subscription
    const client = redis.getClient();
    const subscriber = client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(channel, async (message) => {
      try {
        const event = JSON.parse(message);
        await handler(event);
        logger.debug('Event handled', { eventType, eventId: event.id });
      } catch (error) {
        logger.error('Failed to handle event', {
          error,
          eventType,
          message,
        });
      }
    });

    logger.info('Subscribed to events', { channel });
  }

  /**
   * Consume events from the queue (for reliable delivery)
   */
  async consumeFromQueue(
    eventType: string,
    handler: (event: any) => Promise<void>,
    batchSize: number = 10
  ): Promise<number> {
    const listKey = `${this.channelPrefix}${eventType}:queue`;
    let processedCount = 0;

    try {
      const client = redis.getClient();
      
      // Pop events from the list
      const messages = await client.lPopCount(listKey, batchSize);

      if (!messages) {
        return 0;
      }

      const messagesToProcess = Array.isArray(messages) ? messages : [messages];

      for (const message of messagesToProcess) {
        try {
          const event = JSON.parse(message);
          await handler(event);
          processedCount++;
          logger.debug('Event consumed from queue', {
            eventType,
            eventId: event.id,
          });
        } catch (error) {
          logger.error('Failed to consume event from queue', {
            error,
            eventType,
            message,
          });
          // Push back to the end of the queue for retry
          await client.rPush(listKey, message);
        }
      }

      return processedCount;
    } catch (error) {
      logger.error('Failed to consume from queue', { error, eventType });
      throw error;
    }
  }

  /**
   * Get queue length for monitoring
   */
  async getQueueLength(eventType: string): Promise<number> {
    const listKey = `${this.channelPrefix}${eventType}:queue`;
    const client = redis.getClient();
    return await client.lLen(listKey);
  }

  /**
   * Clear a queue (for testing or maintenance)
   */
  async clearQueue(eventType: string): Promise<void> {
    const listKey = `${this.channelPrefix}${eventType}:queue`;
    const client = redis.getClient();
    await client.del(listKey);
    logger.info('Queue cleared', { eventType });
  }
}

export const eventPublisher = new EventPublisher();
export default eventPublisher;
