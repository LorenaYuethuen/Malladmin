import { Pool, PoolClient } from 'pg';
import config from '../config';
import logger from '../utils/logger';

class Database {
  private pool: Pool;
  private static instance: Database;

  private constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      
      // Connection pool configuration for optimal performance
      min: config.database.pool.min, // Minimum connections to maintain
      max: config.database.pool.max, // Maximum connections allowed
      
      // Timeout configurations
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 5000, // Wait 5 seconds for connection
      
      // Query timeout to prevent long-running queries from blocking
      query_timeout: 30000, // 30 seconds query timeout
      
      // Statement timeout for individual statements
      statement_timeout: 30000, // 30 seconds statement timeout
      
      // Connection validation
      allowExitOnIdle: false, // Keep process alive even if all connections are idle
      
      // Application name for monitoring
      application_name: 'mall_admin_backend',
    });

    // Connection lifecycle events
    this.pool.on('connect', (client) => {
      logger.info('New database connection established');
      
      // Set session-level optimizations
      client.query('SET search_path TO public');
      client.query('SET timezone TO "UTC"');
    });

    this.pool.on('acquire', () => {
      logger.debug('Connection acquired from pool');
    });

    this.pool.on('remove', () => {
      logger.debug('Connection removed from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Unexpected database pool error:', {
        error: err.message,
        stack: err.stack,
      });
    });

    // Log pool statistics periodically (every 60 seconds)
    setInterval(() => {
      logger.debug('Database pool statistics', {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      });
    }, 60000);
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Query error:', { text, error });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  /**
   * Get current pool statistics for monitoring
   */
  public getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Health check for database connectivity
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const db = Database.getInstance();
export default db;
