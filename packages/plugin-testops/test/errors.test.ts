import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorKind,
  classifyError,
  isPermanentUploadError,
  isTerminalUploadError,
  shouldRetryUpload,
  withUploadRetry,
} from "../src/errors.js";

beforeEach(async () => {
  await story("errors");
});

const axiosError = (status: number | undefined, message?: string) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status, data: message ? { message } : {} },
});

describe("classifyError", () => {
  it("classifies no error as none", () => {
    expect(classifyError(undefined)).toBe(ErrorKind.None);
  });

  it.each([408, 429, 500, 502, 503])("classifies HTTP %i as service transient", (status) => {
    expect(classifyError(axiosError(status))).toBe(ErrorKind.ServiceTransient);
  });

  it("classifies a network error with no response as service transient", () => {
    expect(classifyError(axiosError(undefined))).toBe(ErrorKind.ServiceTransient);
  });

  it("classifies HTTP 423 as resource recoverable", () => {
    expect(classifyError(axiosError(423))).toBe(ErrorKind.ResourceRecoverable);
  });

  it("classifies a 'launch is closed' message as resource recoverable regardless of status", () => {
    expect(classifyError(axiosError(400, "Launch is closed"))).toBe(ErrorKind.ResourceRecoverable);
  });

  it.each([401, 403])("classifies HTTP %i as auth terminal", (status) => {
    expect(classifyError(axiosError(status))).toBe(ErrorKind.AuthTerminal);
  });

  it("classifies HTTP 404 as not found terminal", () => {
    expect(classifyError(axiosError(404))).toBe(ErrorKind.NotFoundTerminal);
  });

  it.each([413, 415])("classifies HTTP %i as payload terminal", (status) => {
    expect(classifyError(axiosError(status))).toBe(ErrorKind.PayloadTerminal);
  });

  it("classifies HTTP 409 as conflict terminal", () => {
    expect(classifyError(axiosError(409))).toBe(ErrorKind.ConflictTerminal);
  });

  it("classifies other 4xx as validation terminal", () => {
    expect(classifyError(axiosError(422))).toBe(ErrorKind.ValidationTerminal);
  });

  it("classifies a plain non-axios error as unknown", () => {
    expect(classifyError(new Error("boom"))).toBe(ErrorKind.Unknown);
  });
});

describe("shouldRetryUpload / isPermanentUploadError", () => {
  it("retries transient and recoverable errors", () => {
    expect(shouldRetryUpload(axiosError(503))).toBe(true);
    expect(shouldRetryUpload(axiosError(423))).toBe(true);
  });

  it("does not retry terminal errors", () => {
    expect(shouldRetryUpload(axiosError(401))).toBe(false);
    expect(shouldRetryUpload(axiosError(404))).toBe(false);
  });

  it("treats terminal statuses as permanent", () => {
    expect(isPermanentUploadError(axiosError(401))).toBe(true);
    expect(isPermanentUploadError(axiosError(503))).toBe(false);
  });

  it("is terminal once retries are exhausted even for a retryable error", () => {
    expect(isTerminalUploadError(axiosError(503), 3, 3)).toBe(true);
    expect(isTerminalUploadError(axiosError(503), 1, 3)).toBe(false);
  });
});

describe("withUploadRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    const result = await withUploadRetry(operation, { baseDelayMs: 0 });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a transient error and eventually succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(axiosError(503))
      .mockRejectedValueOnce(axiosError(429))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    const result = await withUploadRetry(operation, { baseDelayMs: 0, onRetry });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a terminal error without retrying", async () => {
    const operation = vi.fn().mockRejectedValue(axiosError(401));

    await expect(withUploadRetry(operation, { baseDelayMs: 0 })).rejects.toEqual(axiosError(401));
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries and rethrows the last error", async () => {
    const operation = vi.fn().mockRejectedValue(axiosError(503));

    await expect(withUploadRetry(operation, { baseDelayMs: 0, maxRetries: 2 })).rejects.toEqual(axiosError(503));
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
