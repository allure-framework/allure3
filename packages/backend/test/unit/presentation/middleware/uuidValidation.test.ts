import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateUUID } from '../../../../src/presentation/api/middleware/uuidValidation.js';
import { ValidationError } from '../../../../src/presentation/api/middleware/errorHandler.js';

const validUuid = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function mockReq(params: Record<string, string> = {}): Request {
  return { params } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

function mockNext(): NextFunction {
  return vi.fn();
}

describe('validateUUID', () => {
  it('calls next() with no args when param is valid UUID', () => {
    const req = mockReq({ launch_id: validUuid });
    const res = mockRes();
    const next = mockNext();

    validateUUID('launch_id')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ValidationError) when param is not a valid UUID', () => {
    const req = mockReq({ launch_id: 'not-a-uuid' });
    const res = mockRes();
    const next = mockNext();

    validateUUID('launch_id')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ValidationError;
    expect(err.message).toContain('must be a valid UUID');
    expect(err.message).toContain('not-a-uuid');
  });

  it('calls next(ValidationError) when param is missing', () => {
    const req = mockReq({});
    const res = mockRes();
    const next = mockNext();

    validateUUID('launch_id')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ValidationError;
    expect(err.message).toContain('required');
  });

  it('accepts uppercase UUID', () => {
    const req = mockReq({ launch_id: validUuid.toUpperCase() });
    const res = mockRes();
    const next = mockNext();

    validateUUID('launch_id')(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
