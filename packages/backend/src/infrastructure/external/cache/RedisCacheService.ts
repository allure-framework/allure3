import Redis from 'ioredis';
import { CacheService } from './CacheService.js';

export interface RedisCacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTtl?: number; // in seconds
  maxRetriesPerRequest?: number;
}

export class RedisCacheService implements CacheService {
  private client: Redis;
  private keyPrefix: string;
  private defaultTtl: number;

  constructor(config: RedisCacheConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.keyPrefix = config.keyPrefix || 'allure:';
    this.defaultTtl = config.defaultTtl || 3600; // 1 hour default

    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }

  private getKey(key: string, namespace?: string): string {
    const prefix = namespace ? `${this.keyPrefix}${namespace}:` : this.keyPrefix;
    return `${prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(this.getKey(key));
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || this.defaultTtl;
      await this.client.setex(this.getKey(key), ttlSeconds, serialized);
    } catch (error) {
      console.error(`Failed to set cache key ${key}:`, error);
      // Don't throw - cache failures should not break the application
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.getKey(key));
    } catch (error) {
      console.error(`Failed to delete cache key ${key}:`, error);
    }
  }

  async clear(namespace?: string): Promise<void> {
    try {
      const pattern = namespace ? `${this.keyPrefix}${namespace}:*` : `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error(`Failed to clear cache namespace ${namespace}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error(`Failed to check cache key existence ${key}:`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
