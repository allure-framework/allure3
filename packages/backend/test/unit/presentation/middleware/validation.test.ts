import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../../../../src/presentation/api/middleware/validation.js';
import { ValidationError } from '../../../../src/presentation/api/middleware/errorHandler.js';

function mockReq(body: unknown = {}): Request {
  return { body } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

function mockNext(): NextFunction {
  return vi.fn();
}

describe('validateRequest', () => {
  it('calls next() and replaces req.body with parsed result for valid createLaunch body', () => {
    const req = mockReq({ name: 'My Launch', environment: 'staging' });
    const res = mockRes();
    const next = mockNext();

    validateRequest('createLaunch')(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual(
      expect.objectContaining({
        name: 'My Launch',
        environment: 'staging'
      })
    );
  });

  it('calls next(ValidationError) for invalid body (empty object, missing name)', () => {
    const req = mockReq({});
    const res = mockRes();
    const next = mockNext();

    validateRequest('createLaunch')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ValidationError;
    expect(err.message).toBe('Validation failed');
    expect(err.details).toBeDefined();
  });

  it('calls next(error) for unknown schema name (no throw)', () => {
    const req = mockReq({ name: 'x' });
    const res = mockRes();
    const next = mockNext();

    validateRequest('nonExistentSchema')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.any(Error)
    );
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as Error;
    expect(err.message).toContain("Validation schema 'nonExistentSchema' not found");
  });
});
