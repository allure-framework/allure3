import { Request, Response, NextFunction } from 'express';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_PAGE = 1;
const MIN_LIMIT = 1;

export function parsePagination(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Parse page
  const pageParam = req.query.page;
  let page = DEFAULT_PAGE;
  
  if (pageParam) {
    const parsedPage = Number(pageParam);
    if (!isNaN(parsedPage) && parsedPage >= MIN_PAGE) {
      page = Math.floor(parsedPage);
    }
  }
  
  // Parse limit
  const limitParam = req.query.limit || req.query.size;
  let limit = DEFAULT_LIMIT;
  
  if (limitParam) {
    const parsedLimit = Number(limitParam);
    if (!isNaN(parsedLimit) && parsedLimit >= MIN_LIMIT) {
      limit = Math.min(Math.floor(parsedLimit), MAX_LIMIT);
    }
  }
  
  // Calculate offset
  const offset = (page - 1) * limit;
  
  // Attach to request
  req.pagination = {
    page,
    limit,
    offset
  };
  
  next();
}
