import { isAxiosError } from "axios";

import type { AttachmentForUpload } from "../model.js";

const MAX_REQUEST_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

const getAxiosCause = (error: unknown) => {
  if (isAxiosError(error)) {
    return error;
  }

  return error instanceof Error && isAxiosError(error.cause) ? error.cause : undefined;
};

const isRetryableRequestError = (error: unknown): boolean => {
  const cause = getAxiosCause(error);

  if (!cause || cause.code === "ERR_CANCELED" || cause.name === "CanceledError") {
    return false;
  }

  const status = cause.response?.status;

  return status === undefined || status === 408 || status === 429 || status >= 500;
};

export const retryAfterMs = (error: unknown): number | undefined => {
  const headers = getAxiosCause(error)?.response?.headers;
  const value = typeof headers?.get === "function" ? headers.get("retry-after") : headers?.["retry-after"];
  const normalized = Array.isArray(value) ? value[0] : value;

  if (typeof normalized !== "string" && typeof normalized !== "number") {
    return undefined;
  }

  const seconds = Number(normalized);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const date = Date.parse(String(normalized));

  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

export const retryRequest = async <T>(request: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= MAX_REQUEST_RETRIES || !isRetryableRequestError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryAfterMs(error) ?? RETRY_BASE_DELAY_MS * 2 ** attempt));
    }
  }
};

export const attachmentByteLength = (attachment: Pick<AttachmentForUpload, "content" | "contentLength">): number => {
  const { content, contentLength } = attachment;

  if (typeof contentLength === "number") {
    return contentLength;
  }

  if (Buffer.isBuffer(content)) {
    return content.length;
  }

  if (typeof Blob !== "undefined" && content instanceof Blob) {
    return content.size;
  }

  return 0;
};
