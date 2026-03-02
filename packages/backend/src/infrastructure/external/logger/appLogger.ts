import { WinstonLogger } from './WinstonLogger.js';

let instance: WinstonLogger | null = null;

/**
 * Shared app logger for controllers and services.
 * Use LOG_LEVEL=debug to trace call sequence and errors.
 */
export function getAppLogger(): WinstonLogger {
  if (!instance) {
    instance = new WinstonLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT === 'text' ? 'text' : 'json',
      enableConsole: true,
      enableFile: false
    });
  }
  return instance;
}
