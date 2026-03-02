import winston from 'winston';
import { join } from 'path';

export interface WinstonLoggerConfig {
  level?: string;
  format?: 'json' | 'text';
  logDirectory?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  maxFiles?: number;
  maxSize?: string;
}

export class WinstonLogger {
  private logger: winston.Logger;

  constructor(config: WinstonLoggerConfig = {}) {
    const level = config.level || process.env.LOG_LEVEL || 'info';
    const format = config.format || 'json';
    const enableConsole = config.enableConsole !== false;
    const enableFile = config.enableFile !== false;

    const logFormat = format === 'json' ? winston.format.json() : winston.format.simple();

    const transports: winston.transport[] = [];

    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            logFormat
          )
        })
      );
    }

    if (enableFile && config.logDirectory) {
      transports.push(
        new winston.transports.File({
          filename: join(config.logDirectory, 'error.log'),
          level: 'error',
          format: winston.format.combine(winston.format.timestamp(), logFormat),
          maxsize: config.maxSize ? this.parseSize(config.maxSize) : 10 * 1024 * 1024, // 10MB default
          maxFiles: config.maxFiles || 5
        }),
        new winston.transports.File({
          filename: join(config.logDirectory, 'combined.log'),
          format: winston.format.combine(winston.format.timestamp(), logFormat),
          maxsize: config.maxSize ? this.parseSize(config.maxSize) : 10 * 1024 * 1024,
          maxFiles: config.maxFiles || 5
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        logFormat
      ),
      transports,
      exitOnError: false
    });
  }

  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    return value * (units[unit] || 1);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  getLogger(): winston.Logger {
    return this.logger;
  }
}
