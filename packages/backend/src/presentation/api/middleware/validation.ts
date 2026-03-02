import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema } from 'zod';
import { CreateLaunchRequestSchema } from '../../../application/dto/requests/CreateLaunchRequest.js';
import { CreateGlobalsRequestSchema } from '../../../application/dto/requests/CreateGlobalsRequest.js';
import { CreateVariablesRequestSchema } from '../../../application/dto/requests/CreateVariablesRequest.js';
import { ValidationError } from './errorHandler.js';

// Reuse schemas from Application Layer
const requestSchemas: Record<string, ZodSchema> = {
  createLaunch: CreateLaunchRequestSchema,
  createGlobals: CreateGlobalsRequestSchema,
  createVariables: CreateVariablesRequestSchema
};

export function validateRequest(schemaName: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const schema = requestSchemas[schemaName];
    
    if (!schema) {
      next(new Error(`Validation schema '${schemaName}' not found`));
      return;
    }

    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Validation failed', error.errors));
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Query validation failed', error.errors));
        return;
      }
      next(error);
    }
  };
}

export function validateParams<T extends ZodSchema>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Parameter validation failed', error.errors));
        return;
      }
      next(error);
    }
  };
}
