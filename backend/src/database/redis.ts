import { createClient, RedisClientType } from 'redis';
import config from '../config';
import logger from '../utils/logger';

class RedisClient {
  private client: RedisClientType;
  private static instance: RedisClient;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.client.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async set(
    key: string,
    value: string,
    options?: { EX?: number; PX?: number }
  ): Promise<void> {
    if (options?.EX) {
      await this.client.set(key, value, { EX: options.EX });
    } else if (options?.PX) {
      await this.client.set(key, value, { PX: options.PX });
    } else {
      await this.client.set(key, value);
    }
  }

  public async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setEx(key, seconds, value);
  }

  public async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  public async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    return await this.client.expire(key, seconds);
  }

  public async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  public async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  public async flushdb(): Promise<void> {
    await this.client.flushDb();
  }

  public async close(): Promise<void> {
    await this.client.quit();
    logger.info('Redis connection closed');
  }
}

export const redis = RedisClient.getInstance();
export default redis;
