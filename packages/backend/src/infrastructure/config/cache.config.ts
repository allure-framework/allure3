import { config } from 'dotenv';
import type { RedisCacheConfig } from '../external/cache/RedisCacheService.js';
import type { WinstonLoggerConfig } from '../external/logger/WinstonLogger.js';

config();

export interface CacheConfig {
  type: 'redis' | 'memory';
  redis?: RedisCacheConfig;
}

export function getCacheConfig(): CacheConfig {
  const cacheType = (process.env.CACHE_TYPE || 'redis') as 'redis' | 'memory';

  const config: CacheConfig = {
    type: cacheType
  };

  if (cacheType === 'redis') {
    config.redis = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'allure:',
      defaultTtl: process.env.REDIS_DEFAULT_TTL ? parseInt(process.env.REDIS_DEFAULT_TTL) : 3600,
      maxRetriesPerRequest: process.env.REDIS_MAX_RETRIES
        ? parseInt(process.env.REDIS_MAX_RETRIES)
        : 3
    };
  }

  return config;
}

export function getLoggerConfig(): WinstonLoggerConfig {
  return {
    level: process.env.LOG_LEVEL || 'info',
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE !== 'false',
    maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES) : 5,
    maxSize: process.env.LOG_MAX_SIZE || '10mb'
  };
}
