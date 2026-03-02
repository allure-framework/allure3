export interface ErrorResponse {
  error: string;
  details?: string | Record<string, any>;
  code?: string;
  timestamp?: string;
}

export interface SuccessResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function createErrorResponse(
  error: string,
  code?: string,
  details?: string | Record<string, any>
): ErrorResponse {
  return {
    error,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

export function createSuccessResponse<T>(
  data: T,
  message?: string
): SuccessResponse<T> {
  return {
    data,
    message
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
