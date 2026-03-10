import { createApp } from './app';
import config from './config';
import logger from './utils/logger';
import { outboxProcessor } from './services/outboxProcessor';
import redis from './database/redis';
import { initializeRateLimiters } from './middleware/rateLimiter';
import { startReservationCleanupTask, stopReservationCleanupTask } from './services/inventoryService';

// Initialize Redis connection
async function initializeRedis() {
  try {
    await redis.connect();
    logger.info('Redis connected successfully');
    
    // Initialize rate limiters after Redis is connected
    initializeRateLimiters();
    logger.info('Rate limiters initialized');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// Create Express app
const app = createApp();

// Start server with Redis initialization
async function startServer() {
  try {
    // Initialize Redis first
    await initializeRedis();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        env: config.env,
        apiVersion: config.apiVersion,
      });
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📚 API version: ${config.apiVersion}`);
      console.log(`🌍 Environment: ${config.env}`);
      
      // Start outbox processor for reliable event publishing
      outboxProcessor.start();
      logger.info('Outbox processor started');

      // Start inventory reservation cleanup task (every 60s, 15min expiry)
      startReservationCleanupTask();
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutdown signal received: closing connections');
      
      // Stop outbox processor first
      outboxProcessor.stop();
      logger.info('Outbox processor stopped');

      // Stop reservation cleanup task
      stopReservationCleanupTask();
      
      // Close Redis connection
      await redis.close();
      logger.info('Redis connection closed');
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Don't exit immediately in development to allow debugging
  if (config.env === 'production') {
    process.exit(1);
  }
});

export default app;
