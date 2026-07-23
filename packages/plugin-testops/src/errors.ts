import { setTimeout as delay } from "node:timers/promises";

import { KnownError, UnknownError } from "@allurereport/service";
import { isAxiosError } from "axios";

export enum ErrorKind {
  None = "none",
  ServiceTransient = "service_transient",
  ResourceRecoverable = "resource_recoverable",
  AuthTerminal = "auth_terminal",
  NotFoundTerminal = "not_found_terminal",
  PayloadTerminal = "payload_terminal",
  ValidationTerminal = "validation_terminal",
  ConflictTerminal = "conflict_terminal",
  Unknown = "unknown",
}

const isLaunchClosedMessage = (message: string | undefined): boolean => {
  if (!message) {
    return false;
  }

  const lower = message.toLowerCase();

  return lower.includes("launch is closed") || lower.includes("closed launch");
};

const responseStatus = (error: unknown): number | undefined =>
  isAxiosError(error) ? error.response?.status : undefined;

const responseMessage = (error: unknown): string | undefined => {
  if (!isAxiosError(error)) {
    return undefined;
  }

  const data = error.response?.data as { message?: string } | undefined;

  return data?.message;
};

const classifyHttpStatus = (status: number): ErrorKind => {
  if (status === 408 || status === 429 || status >= 500) {
    return ErrorKind.ServiceTransient;
  }

  if (status === 423) {
    return ErrorKind.ResourceRecoverable;
  }

  if (status === 401 || status === 403) {
    return ErrorKind.AuthTerminal;
  }

  if (status === 404) {
    return ErrorKind.NotFoundTerminal;
  }

  if (status === 413 || status === 415) {
    return ErrorKind.PayloadTerminal;
  }

  if (status === 409) {
    return ErrorKind.ConflictTerminal;
  }

  if (status >= 400 && status < 500) {
    return ErrorKind.ValidationTerminal;
  }

  return ErrorKind.Unknown;
};

export const isClosedLaunchError = (error: unknown): boolean => {
  if (isAxiosError(error)) {
    return isLaunchClosedMessage(responseMessage(error));
  }

  // TestOpsClient never sees a raw AxiosError: @allurereport/service's createServiceHttpClient
  // already unwraps it into a KnownError/UnknownError, formatting the response message into
  // `.message` in the process — so the "launch is closed" text still survives there
  if (error instanceof KnownError || error instanceof UnknownError) {
    return isLaunchClosedMessage(error.message);
  }

  return false;
};

export const classifyError = (error: unknown): ErrorKind => {
  if (!error) {
    return ErrorKind.None;
  }

  if (isAxiosError(error)) {
    if (isLaunchClosedMessage(responseMessage(error))) {
      return ErrorKind.ResourceRecoverable;
    }

    const status = responseStatus(error);

    // no response at all: network error, DNS failure, connection reset, request timeout, ...
    return status === undefined ? ErrorKind.ServiceTransient : classifyHttpStatus(status);
  }

  // real TestOpsClient calls surface a KnownError (status < 500, response known) or an
  // UnknownError (status >= 500, or no response at all) — see the comment on isClosedLaunchError
  if (error instanceof KnownError) {
    if (isLaunchClosedMessage(error.message)) {
      return ErrorKind.ResourceRecoverable;
    }

    return typeof error.status === "number" ? classifyHttpStatus(error.status) : ErrorKind.Unknown;
  }

  if (error instanceof UnknownError) {
    if (isLaunchClosedMessage(error.message)) {
      return ErrorKind.ResourceRecoverable;
    }

    // UnknownError only ever represents a 5xx response or a request that never got one
    return ErrorKind.ServiceTransient;
  }

  if (error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message))) {
    return ErrorKind.ServiceTransient;
  }

  return ErrorKind.Unknown;
};

export const shouldRetryUpload = (error: unknown): boolean => {
  const kind = classifyError(error);

  return kind === ErrorKind.ServiceTransient || kind === ErrorKind.ResourceRecoverable;
};

export const isPermanentUploadError = (error: unknown): boolean => {
  switch (classifyError(error)) {
    case ErrorKind.AuthTerminal:
    case ErrorKind.NotFoundTerminal:
    case ErrorKind.PayloadTerminal:
    case ErrorKind.ValidationTerminal:
    case ErrorKind.ConflictTerminal:
      return true;
    default:
      return false;
  }
};

export const isTerminalUploadError = (error: unknown, retries: number, maxRetries: number): boolean =>
  isPermanentUploadError(error) || retries >= maxRetries;

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5_000;

/**
 * Retries an upload operation with exponential backoff, but only for errors classified as
 * retryable (transient service errors, a recoverable "launch is closed" race). Terminal errors
 * (auth, validation, payload too large, ...) fail fast on the first attempt.
 */
export const withUploadRetry = async <T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onRetry,
  } = options;
  let attempt = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!shouldRetryUpload(error) || isTerminalUploadError(error, attempt, maxRetries)) {
        throw error;
      }

      attempt += 1;
      await onRetry?.(error, attempt);

      const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));

      await delay(backoffMs);
    }
  }
};
