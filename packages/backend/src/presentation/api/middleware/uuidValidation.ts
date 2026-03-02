import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    
    if (!value) {
      next(new ValidationError(`Parameter '${paramName}' is required`));
      return;
    }
    
    // Check if it's a valid UUID
    if (!UUID_REGEX.test(value)) {
      next(new ValidationError(`Parameter '${paramName}' must be a valid UUID, got: ${value}`));
      return;
    }
    
    next();
  };
}
