import { Express } from 'express';
import { errorHandler } from './errorHandler.js';
import { requestLogger } from './requestLogger.js';
import { corsMiddleware } from './cors.js';
import { securityMiddleware } from './security.js';
import { compressionMiddleware } from './compression.js';
import { jsonParser, urlEncodedParser } from './bodyParser.js';

export function setupMiddleware(app: Express): void {
  // Security and CORS (should be first)
  app.use(securityMiddleware);
  app.use(corsMiddleware);
  
  // Compression
  app.use(compressionMiddleware);
  
  // Body parsing
  app.use(jsonParser);
  app.use(urlEncodedParser);
  
  // Request logging
  app.use(requestLogger);
  
  // Note: Error handler should be added AFTER routes in main app file
}

export { errorHandler, AppError, ValidationError, NotFoundError, DomainError, UnauthorizedError, ForbiddenError } from './errorHandler.js';
export * from './validation.js';
export * from './pagination.js';
export * from './filtering.js';
export * from './requestLogger.js';
export * from './rateLimiting.js';
export * from './uuidValidation.js';
export { asyncHandler } from './asyncHandler.js';