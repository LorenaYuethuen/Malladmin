import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'mall_admin',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Increased from 10 for better concurrency
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10),
      queryTimeoutMillis: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    },
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  },

  // External Services
  externalServices: {
    payment: {
      url: process.env.PAYMENT_GATEWAY_URL || '',
      key: process.env.PAYMENT_GATEWAY_KEY || '',
    },
    logistics: {
      url: process.env.LOGISTICS_API_URL || '',
      key: process.env.LOGISTICS_API_KEY || '',
    },
    inventory: {
      url: process.env.INVENTORY_API_URL || '',
      key: process.env.INVENTORY_API_KEY || '',
    },
  },

  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
  },

  // CSRF Protection
  csrf: {
    enabled: process.env.CSRF_ENABLED !== 'false', // Enabled by default
    cookieName: process.env.CSRF_COOKIE_NAME || 'csrf-token',
    headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
    tokenLength: parseInt(process.env.CSRF_TOKEN_LENGTH || '32', 10),
  },
};

export default config;
