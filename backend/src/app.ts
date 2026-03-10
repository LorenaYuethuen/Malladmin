import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from './config';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { setCsrfToken, getCsrfToken } from './middleware/csrf';
import { metricsMiddleware } from './middleware/metrics';
import logger from './utils/logger';

// Import routes
import routes from './routes';
import metricsRoutes from './routes/metricsRoutes';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors(config.cors));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parser middleware (required for CSRF protection)
  app.use(cookieParser());

  // Request ID middleware
  app.use(requestIdMiddleware);

  // Metrics middleware (should be early in the chain)
  app.use(metricsMiddleware);

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      requestId: res.locals.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // CSRF token endpoint - allows clients to retrieve CSRF token
  app.get('/api/csrf-token', setCsrfToken, getCsrfToken);

  // Metrics endpoint (Prometheus)
  app.use(metricsRoutes);

  // API routes
  app.use(`/api/${config.apiVersion}`, routes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
