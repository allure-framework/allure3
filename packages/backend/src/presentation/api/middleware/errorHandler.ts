import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/responses.js';
import { WinstonLogger } from '../../../infrastructure/external/logger/WinstonLogger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND');
  }
}

export class DomainError extends AppError {
  constructor(message: string, details?: any) {
    super(422, message, 'DOMAIN_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
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

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = getLogger();
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    logger.error('JSON parsing error', {
      error: err.message,
      path: req.path,
      method: req.method,
      bodyPreview: typeof req.body === 'string' ? req.body.substring(0, 500) : 'N/A'
    });
    
    res.status(400).json({
      error: 'Invalid JSON',
      code: 'INVALID_JSON',
      details: err.message,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Log error (include code and details for AppError to trace sequence)
  logger.error('Request error', {
    error: err.message,
    code: err instanceof AppError ? err.code : undefined,
    details: err instanceof AppError ? err.details : undefined,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: err instanceof AppError ? err.statusCode : 500
  });
  
  // Handle known error types
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date().toISOString()
    };
    res.status(err.statusCode).json(response);
    return;
  }
  
  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const response: ErrorResponse = {
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: (err as any).errors,
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  
  // Handle TypeORM errors
  if (err.name === 'QueryFailedError') {
    const message = (err as any).driverError?.message ?? (err as Error).message;
    const isInvalidUuid =
      typeof message === 'string' &&
      /invalid input syntax for type uuid/i.test(message);
    if (isInvalidUuid) {
      const response: ErrorResponse = {
        error: 'Invalid UUID format',
        code: 'INVALID_UUID',
        details: message,
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    const response: ErrorResponse = {
      error: 'Database error',
      code: 'DATABASE_ERROR',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
    return;
  }
  
  // Default error response
  const response: ErrorResponse = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  };
  
  res.status(500).json(response);
}
