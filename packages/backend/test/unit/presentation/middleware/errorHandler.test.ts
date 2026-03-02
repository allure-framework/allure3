import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  ValidationError,
  NotFoundError
} from '../../../../src/presentation/api/middleware/errorHandler.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/test',
    method: 'GET',
    body: undefined,
    ...overrides
  } as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockNext(): NextFunction {
  return vi.fn();
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends 400 with error/code/timestamp for AppError (ValidationError)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new ValidationError('Bad input', [{ path: ['name'] }]);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Bad input',
        code: 'VALIDATION_ERROR',
        details: [{ path: ['name'] }],
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 404 with error/code for NotFoundError', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new NotFoundError('Launch', 'missing-id');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Launch not found: missing-id',
        code: 'NOT_FOUND',
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 400 for SyntaxError with body (invalid JSON)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new SyntaxError('Unexpected token') as SyntaxError & { body?: unknown };
    err.body = '{ invalid }';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid JSON',
        code: 'INVALID_JSON',
        details: 'Unexpected token',
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 400 for ZodError with VALIDATION_ERROR code', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new Error('Zod validation failed');
    err.name = 'ZodError';
    (err as { errors: unknown }).errors = [{ message: 'Required' }];

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: [{ message: 'Required' }],
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 400 for QueryFailedError with uuid message (INVALID_UUID)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new Error('query failed');
    err.name = 'QueryFailedError';
    (err as { driverError?: { message?: string } }).driverError = {
      message: 'invalid input syntax for type uuid'
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_UUID',
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 500 for QueryFailedError without uuid message (DATABASE_ERROR)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new Error('connection refused');
    err.name = 'QueryFailedError';
    (err as { driverError?: { message?: string } }).driverError = {
      message: 'connection refused'
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DATABASE_ERROR',
        timestamp: expect.any(String)
      })
    );
  });

  it('sends 500 for generic Error (INTERNAL_ERROR)', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const err = new Error('Something broke');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String)
      })
    );
  });
});
