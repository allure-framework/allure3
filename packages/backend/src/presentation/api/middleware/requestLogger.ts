import { Request, Response, NextFunction } from 'express';
import { WinstonLogger } from '../../../infrastructure/external/logger/WinstonLogger.js';

interface LogData {
  method: string;
  path: string;
  query?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  duration?: number;
  body?: any;
}

function sanitizeBody(body: any): any {
  if (!body) return undefined;
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Limit body size for logging (avoid parsing truncated JSON)
  const bodyStr = JSON.stringify(sanitized);
  if (bodyStr.length > 1000) {
    return { _truncated: true, _preview: bodyStr.substring(0, 500) + '...' };
  }
  
  return sanitized;
}

let loggerInstance: WinstonLogger | null = null;

function getLogger(): WinstonLogger {
  if (!loggerInstance) {
    loggerInstance = new WinstonLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      enableConsole: true,
      enableFile: false
    });
  }
  return loggerInstance;
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = getLogger();
  const startTime = Date.now();
  
  // Log request
  const logData: LogData = {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    body: sanitizeBody(req.body)
  };
  
  logger.info('Incoming request', logData);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog: LogData = {
      ...logData,
      statusCode: res.statusCode,
      duration
    };
    
    if (res.statusCode >= 400) {
      logger.error('Request failed', responseLog);
    } else {
      logger.info('Request completed', responseLog);
    }
  });
  
  next();
}
