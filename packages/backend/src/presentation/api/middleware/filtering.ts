import { Request, Response, NextFunction } from 'express';

const VALID_STATUSES = ['failed', 'broken', 'passed', 'skipped', 'unknown'] as const;
const VALID_SORT_DIRECTIONS = ['asc', 'desc'] as const;
const VALID_SORT_FIELDS = ['time', 'name', 'status', 'duration'] as const;

export function parseFilters(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const filters: {
    status?: string;
    labelName?: string;
    labelValue?: string;
    search?: string;
    sort?: {
      field: string;
      direction: 'asc' | 'desc';
    };
  } = {};
  
  // Parse status filter
  if (req.query.status) {
    const status = String(req.query.status).toLowerCase();
    if (VALID_STATUSES.includes(status as any)) {
      filters.status = status;
    }
  }
  
  // Parse label filter (format: "name:value" or just "name")
  if (req.query.label) {
    const labelStr = String(req.query.label);
    const colonIndex = labelStr.indexOf(':');
    
    if (colonIndex > 0) {
      filters.labelName = labelStr.substring(0, colonIndex);
      filters.labelValue = labelStr.substring(colonIndex + 1);
    } else {
      filters.labelName = labelStr;
    }
  }
  
  // Parse search query (full-text search)
  if (req.query.search || req.query.q) {
    filters.search = String(req.query.search || req.query.q);
  }
  
  // Parse sort (format: "field:direction" or just "field")
  if (req.query.sort) {
    const sortStr = String(req.query.sort);
    const colonIndex = sortStr.indexOf(':');
    
    if (colonIndex > 0) {
      const field = sortStr.substring(0, colonIndex);
      const direction = sortStr.substring(colonIndex + 1).toLowerCase();
      
      if (VALID_SORT_FIELDS.includes(field as any) && 
          VALID_SORT_DIRECTIONS.includes(direction as any)) {
        filters.sort = {
          field,
          direction: direction as 'asc' | 'desc'
        };
      }
    } else if (VALID_SORT_FIELDS.includes(sortStr as any)) {
      filters.sort = {
        field: sortStr,
        direction: 'asc' // default
      };
    }
  }
  
  // Attach to request
  req.filters = filters;
  
  next();
}
