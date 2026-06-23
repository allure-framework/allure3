import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";

import { log } from "../logger.js";
import type { UploadReportConfig, UploadReportPayload, UploadReportResult } from "../model.js";
import { isReportDataFile } from "./files.js";

/**
 * The error that was explicitly thrown by the service
 */
export class KnownError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "KnownError";
    this.status = status;
  }
}

/**
 * Internal Service Error
 */
export class InternalError extends Error {
  stack?: string;
  name = "InternalError";

  constructor(message: string, stack?: string) {
    super(message);
    this.stack = stack;
  }
}

const ERROR_MESSAGE_FIELDS = ["message", "error_description", "error", "detail", "title", "description"];

/** Keys masked in `AxiosError#toJSON()` serialized config. See axios request `redact` option. */
export const AXIOS_REDACT_KEYS = ["authorization", "password", "secret", "token", "apitoken", "accesstoken"];

const stringifyErrorObject = (value: Record<string, unknown>) => {
  try {
    return JSON.stringify(value);
  } catch {
    const entries = Object.entries(value).map(([key, entryValue]) => `${key}=${String(entryValue)}`);

    return entries.length > 0 ? `{ ${entries.join(", ")} }` : undefined;
  }
};

export const formatResponseErrorData = (data: unknown): string | undefined => {
  if (data === undefined || data === null || data === "") {
    return undefined;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean" || typeof data === "bigint") {
    return String(data);
  }

  if (Array.isArray(data)) {
    const items = data.map(formatResponseErrorData).filter(Boolean);

    return items.length > 0 ? items.join("; ") : undefined;
  }

  if (typeof data !== "object") {
    return String(data);
  }

  const errorData = data as Record<string, unknown>;

  for (const field of ERROR_MESSAGE_FIELDS) {
    const message = formatResponseErrorData(errorData[field]);

    if (message) {
      return message;
    }
  }

  return stringifyErrorObject(errorData);
};

export const formatServiceHttpErrorMessage = (payload: {
  method: string;
  endpoint: string;
  status?: number;
  statusText?: string;
  data?: unknown;
  fallbackMessage?: string;
}) => {
  const { method, endpoint, status, statusText, data, fallbackMessage } = payload;
  const request = `${method.toUpperCase()} ${endpoint}`;
  const statusMessage = status ? ` responded with ${status}${statusText ? ` ${statusText}` : ""}` : " failed";
  const details = formatResponseErrorData(data) || fallbackMessage;

  return `Allure service request failed: ${request}${statusMessage}${details ? `: ${details}` : ""}`;
};

type ServiceRequestPayload = AxiosRequestConfig & { params?: Record<string, unknown>; body?: unknown };

const buildFailedRequestDebugContext = (axiosError: AxiosError) => {
  const { data, status, statusText } = axiosError.response ?? {};
  const serialized = axiosError.toJSON() as {
    message: AxiosError["message"];
    name: AxiosError["name"];
    stack: AxiosError["stack"];
    config: AxiosError["config"];
    code: AxiosError["code"];
    status: AxiosError["status"];
  };

  return {
    method: serialized.config?.method,
    path: serialized.config?.url,
    body: serialized.config?.data,
    responseData: data,
    params: serialized.config?.params,
    status: status ?? serialized.status,
    statusText: statusText ?? serialized.code,
  };
};

export const createServiceHttpClient = (
  serviceUrl: string,
  params?: {
    accessToken?: string;
    apiToken?: string;
  },
) => {
  const client = axios.create({
    baseURL: serviceUrl,
    validateStatus: (status) => status < 400,
    redact: AXIOS_REDACT_KEYS,
  });
  const sendRequest =
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: ServiceRequestPayload) => {
      const headers = {
        ...(payload?.headers ?? {}),
      };

      if (params?.accessToken) {
        headers.Authorization = `Bearer ${params.accessToken}`;
      }

      if (params?.apiToken) {
        headers.Authorization = `api-token ${params.apiToken}`;
      }

      try {
        let res: AxiosResponse<T>;

        if (method === "get" || method === "delete") {
          res = await client[method]<T>(endpoint, {
            ...payload,
            headers,
          });
        } else {
          res = await client[method]<T>(endpoint, payload?.body, {
            ...payload,
            headers,
          });
        }

        return res.data;
      } catch (err) {
        const axiosError = isAxiosError(err);

        if (!axiosError) {
          throw err;
        }

        log.debug(buildFailedRequestDebugContext(err as AxiosError), "service HTTP request failed");

        const { data, status, statusText } = (err as AxiosError).response ?? {};

        const responseStatus = status ?? 500;

        const errorMessage = formatServiceHttpErrorMessage({
          method,
          endpoint,
          status,
          statusText,
          data,
          fallbackMessage: err.message,
        });

        if (responseStatus < 500) {
          throw new KnownError(errorMessage, responseStatus);
        }

        throw new InternalError(errorMessage, err.stack);
      }
    };

  return {
    get: sendRequest("get"),
    post: sendRequest("post"),
    put: sendRequest("put"),
    delete: sendRequest("delete"),
  } as const;
};

export type HttpClient = ReturnType<typeof createServiceHttpClient>;

const uploadWithRetry = async (
  filename: string,
  uploadAbortController: AbortController,
  failedUploads: Set<string>,
  maxAttempts: number,
  maxSimultaneousFailures: number,
  uploadFn: () => Promise<void>,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (uploadAbortController.signal.aborted) {
      return false;
    }

    try {
      await uploadFn();

      failedUploads.delete(filename);

      return true;
    } catch (error) {
      if (uploadAbortController.signal.aborted) {
        return false;
      }

      failedUploads.add(filename);

      if (failedUploads.size > maxSimultaneousFailures || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  return false;
};

export const uploadReport = async (
  payload: UploadReportPayload &
    UploadReportConfig & {
      addReportAsset: (payload: { filename: string; filepath: string; signal?: AbortSignal }) => Promise<unknown>;
      addReportFile: (payload: {
        reportUuid: string;
        pluginId?: string;
        filename: string;
        filepath: string;
        signal?: AbortSignal;
      }) => Promise<string>;
    },
): Promise<UploadReportResult> => {
  const {
    reportUuid,
    pluginId,
    files,
    onProgress,
    addReportAsset,
    addReportFile,
    uploadConcurrency,
    uploadMaxAttempts,
    uploadMaxSimultaneousFailures,
  } = payload;
  const fileEntries = Object.entries(files);

  if (fileEntries.length === 0) {
    return {
      hrefs: {},
    };
  }

  const uploadAbortController = new AbortController();
  const failedUploads = new Set<string>();
  const hrefs: Record<string, string> = {};
  let indexHref: string | undefined;
  let nextFileIndex = 0;
  const uploadNext = async (): Promise<void> => {
    while (!uploadAbortController.signal.aborted) {
      const fileIndex = nextFileIndex++;

      if (fileIndex >= fileEntries.length) {
        return;
      }

      const [filename, filepath] = fileEntries[fileIndex];
      let fileUrl: string | undefined;
      const uploaded = await uploadWithRetry(
        filename,
        uploadAbortController,
        failedUploads,
        uploadMaxAttempts,
        uploadMaxSimultaneousFailures,
        async () => {
          if (isReportDataFile(filename)) {
            fileUrl = await addReportFile({
              reportUuid,
              pluginId,
              filename,
              filepath,
              signal: uploadAbortController.signal,
            });
          } else {
            await addReportAsset({
              filename,
              filepath,
              signal: uploadAbortController.signal,
            });
          }
        },
      );

      if (!uploaded || uploadAbortController.signal.aborted) {
        return;
      }

      if (fileUrl) {
        hrefs[filename] = fileUrl;

        if (filename === "index.html") {
          indexHref = fileUrl;
        }
      }

      onProgress?.();
    }
  };

  const uploadTasks = Array.from({ length: Math.min(uploadConcurrency, fileEntries.length) }, () => uploadNext());

  try {
    await Promise.all(uploadTasks);
  } catch (error) {
    uploadAbortController.abort();
    await Promise.allSettled(uploadTasks);

    throw error;
  }

  return {
    indexHref,
    hrefs,
  };
};
