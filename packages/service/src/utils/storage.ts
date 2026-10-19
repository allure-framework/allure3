import { stat } from "node:fs/promises";
import { posix, win32 } from "node:path";

import type { UploadReportConfig, UploadReportFilePayload, UploadReportPayload, UploadReportResult } from "../model.js";
import { isReportDataFile } from "./files.js";
import { KnownError, type ServiceHttpErrorDetails, UnknownError } from "./http.js";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
  "ERR_NETWORK",
]);
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;

export type StorageUploadFile = UploadReportFilePayload & {
  kind: "report" | "asset";
  normalizedFilename: string;
  remotePath: string;
  size: number;
};

const abortError = (signal: AbortSignal) => {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }

  const error = new Error("The upload was aborted");

  error.name = "AbortError";

  return error;
};

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw abortError(signal);
  }
};

export const normalizeUploadPath = (path: string): string => {
  if (!path || path.includes("\0")) {
    throw new Error(`Invalid upload path "${path}": the path must be non-empty and must not contain NUL`);
  }

  const normalizedSeparators = path.replaceAll(win32.sep, posix.sep);

  if (posix.isAbsolute(normalizedSeparators) || win32.parse(path).root !== "") {
    throw new Error(`Invalid upload path "${path}": the path must be relative`);
  }

  const segments = normalizedSeparators.split(posix.sep);

  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Invalid upload path "${path}": empty, "." and ".." segments are not allowed`);
  }

  return posix.normalize(normalizedSeparators);
};

export const encodeUploadPath = (path: string) =>
  encodeURIComponent(path).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const prepareUploadFiles = async (payload: UploadReportPayload, signal: AbortSignal): Promise<StorageUploadFile[]> => {
  const { pluginId } = payload;
  const normalizedPluginId = pluginId ? normalizeUploadPath(pluginId) : undefined;
  const fileSets = Array.isArray(payload.files) ? payload.files : [payload.files];
  const files: StorageUploadFile[] = [];
  const uniqueAssets = new Map<string, StorageUploadFile>();

  for (const fileSet of fileSets) {
    for (const [filename, filepath] of Object.entries(fileSet)) {
      throwIfAborted(signal);

      const normalizedFilename = normalizeUploadPath(filename);
      const kind = isReportDataFile(normalizedFilename) ? "report" : "asset";
      const remotePath =
        kind === "report" && normalizedPluginId ? `${normalizedPluginId}/${normalizedFilename}` : normalizedFilename;

      if (kind === "asset" && uniqueAssets.has(remotePath)) {
        continue;
      }

      const size = (await stat(filepath)).size;
      const file: StorageUploadFile = {
        filename,
        filepath,
        kind,
        normalizedFilename,
        remotePath,
        size,
        signal,
      };

      if (kind === "report") {
        files.push(file);
        continue;
      }

      uniqueAssets.set(remotePath, file);
    }
  }

  files.push(...uniqueAssets.values());

  return files;
};

const parseRetryAfter = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return Math.max(0, timestamp - Date.now());
};

/**
 * Calculates the delay before the next retry in milliseconds.
 * A valid Retry-After value takes precedence; otherwise, full jitter is applied to capped exponential backoff.
 */
const retryDelay = (attempt: number, retryAfter: string | undefined) => {
  const serverDelay = parseRetryAfter(retryAfter);

  if (serverDelay !== undefined) {
    return serverDelay;
  }

  const maximumDelay = Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1));

  return Math.floor(Math.random() * maximumDelay);
};

const waitForRetry = async (delay: number, signal: AbortSignal) => {
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const timeout = setTimeout(finish, delay);
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    void Promise.resolve().then(() => {
      if (signal.aborted) {
        onAbort();
      }
    });
  });
};

const errorDetails = (error: unknown): ServiceHttpErrorDetails | undefined => {
  if (error instanceof KnownError || error instanceof UnknownError) {
    return error.details;
  }

  return undefined;
};

const isRetryable = (error: unknown) => {
  const details = errorDetails(error);

  if (!details) {
    return false;
  }

  if (details.status !== undefined) {
    return RETRYABLE_STATUSES.has(details.status);
  }

  return details.networkCode === undefined || RETRYABLE_NETWORK_CODES.has(details.networkCode);
};

const formatUploadError = (file: StorageUploadFile, error: unknown, attempts: number) => {
  const details = errorDetails(error);
  const operation = file.kind === "report" ? "upload report file" : "upload shared asset";

  if (!details) {
    return error;
  }

  const method = details.method.toUpperCase();

  if (details.status === 403 && details.mitigated === "challenge") {
    return new KnownError(
      `Allure service request failed: ${operation} ${method} ${details.endpoint} was blocked by a Cloudflare managed challenge (status 403${
        details.rayId ? `, ray ${details.rayId}` : ""
      }, path "${file.remotePath}", attempts ${attempts}). Machine API routes must be excluded from browser challenges.`,
      403,
      { cause: error, details },
    );
  }

  const result = [
    `Allure service request failed: ${operation} ${method} ${details.endpoint}`,
    details.status
      ? ` responded with ${details.status}${details.statusText ? ` ${details.statusText}` : ""}`
      : " failed",
    ` (path "${file.remotePath}", attempts ${attempts}`,
    details.rayId ? `, ray ${details.rayId}` : "",
    details.mitigated ? `, cf-mitigated ${details.mitigated}` : "",
    ")",
    details.responseMessage ? `: ${details.responseMessage}` : "",
  ].join("");

  if (details.status !== undefined) {
    return new KnownError(result, details.status, { cause: error, details });
  }

  return new UnknownError(result, error instanceof Error ? error.stack : undefined, { cause: error, details });
};

const uploadWithRetry = async (
  file: StorageUploadFile,
  signal: AbortSignal,
  failedUploads: Set<string>,
  maxAttempts: number,
  upload: (file: StorageUploadFile, signal: AbortSignal) => Promise<string | undefined>,
): Promise<string | undefined> => {
  const attempts =
    typeof maxAttempts === "number" && Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : 5;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    throwIfAborted(signal);

    try {
      const result = await upload(file, signal);

      failedUploads.delete(file.remotePath);

      return result;
    } catch (error) {
      if (signal.aborted) {
        throw abortError(signal);
      }

      if (!isRetryable(error)) {
        throw formatUploadError(file, error, attempt);
      }

      failedUploads.add(file.remotePath);

      if (attempt >= attempts) {
        throw formatUploadError(file, error, attempt);
      }

      const details = errorDetails(error);
      const delay = retryDelay(attempt, details?.retryAfter);

      console.warn("Retrying Allure service upload", {
        endpoint: details?.endpoint,
        attempt: attempt + 1,
        status: details?.status ?? details?.networkCode ?? "network error",
        delay,
      });

      await waitForRetry(delay, signal);
    }
  }

  return undefined;
};

export const uploadStorageReport = async (
  payload: UploadReportPayload &
    UploadReportConfig & {
      uploadedAssets: Set<string>;
      upload: (file: StorageUploadFile, signal: AbortSignal) => Promise<string | undefined>;
    },
): Promise<UploadReportResult> => {
  const { onProgress, uploadConcurrency, uploadMaxAttempts, uploadedAssets, upload } = payload;
  const controller = new AbortController();
  const externalSignal = payload.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);

  if (externalSignal) {
    externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });

    if (externalSignal.aborted) {
      abortFromExternalSignal();
    }
  }

  try {
    const prepared = await prepareUploadFiles(payload, controller.signal);
    const files = prepared.filter((file) => file.kind === "report" || !uploadedAssets.has(file.remotePath));

    if (files.length === 0) {
      throwIfAborted(controller.signal);

      return { hrefs: {} };
    }

    const failedUploads = new Set<string>();
    const hrefs: Record<string, string> = {};
    let indexHref: string | undefined;
    let nextFileIndex = 0;

    const uploadNext = async () => {
      while (!controller.signal.aborted) {
        const fileIndex = nextFileIndex++;

        if (fileIndex >= files.length) {
          return;
        }

        const file = files[fileIndex];
        const href = await uploadWithRetry(file, controller.signal, failedUploads, uploadMaxAttempts, upload);

        if (file.kind === "asset") {
          uploadedAssets.add(file.remotePath);
        } else if (href) {
          hrefs[file.filename] = href;

          if (file.normalizedFilename === "index.html") {
            indexHref = href;
          }
        }

        onProgress?.(1);
      }
    };
    const workerCount = Math.min(uploadConcurrency, files.length);
    const workers = Array.from({ length: workerCount }, () => uploadNext());

    try {
      await Promise.all(workers);
      throwIfAborted(controller.signal);
    } catch (error) {
      controller.abort(error);
      await Promise.allSettled(workers);
      throw error;
    }

    return { indexHref, hrefs };
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally {
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
};
