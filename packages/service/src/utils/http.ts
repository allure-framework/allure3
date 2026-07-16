import { stat } from "node:fs/promises";

import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";

import type {
  UploadReportConfig,
  UploadReportFilePayload,
  UploadReportFilesPayload,
  UploadReportPayload,
  UploadReportResult,
} from "../model.js";
import { isReportDataFile } from "./files.js";

/**
 * The error that was explicitly thrown by the service. We can print the error's message as is to the user
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
 * Unknown error (such as internal server error or error that was not explicitly thrown by the service)
 * We can't print the error's message directly to the user, so we need to add additionaly logic to handle it
 */
export class UnknownError extends Error {
  stack?: string;

  constructor(message: string, stack?: string) {
    super(message);
    this.name = "UnknownError";
    this.stack = stack;
  }
}

const ERROR_MESSAGE_FIELDS = ["message", "error_description", "error", "detail", "title", "description"];

const stringifyErrorObject = (value: Record<string, unknown>) => {
  try {
    return JSON.stringify(value);
  } catch {
    const entries = Object.entries(value).map(([key, entryValue]) => `${key}=${String(entryValue)}`);

    return entries.length > 0 ? `{ ${entries.join(", ")} }` : undefined;
  }
};

const MAX_UPLOAD_BATCH_FILES = 32;

const createUploadFileBatches = (files: Record<string, string>): Record<string, string>[] => {
  const entries = Object.entries(files);

  const batches: Record<string, string>[] = [];
  let batch: Record<string, string> = {};
  let batchFiles = 0;

  const flushBatch = () => {
    if (batchFiles === 0) {
      return;
    }

    batches.push(batch);

    batch = {};
    batchFiles = 0;
  };

  for (const [filename, filepath] of entries) {
    if (batchFiles >= MAX_UPLOAD_BATCH_FILES) {
      flushBatch();
    }

    batch[filename] = filepath;
    batchFiles += 1;
  }

  flushBatch();

  return batches;
};

const createUploadFileBatchesBySize = async (
  files: Record<string, string>,
  maxBytes: number,
): Promise<Record<string, string>[]> => {
  const entries = Object.entries(files);
  const batches: Record<string, string>[] = [];
  let batch: Record<string, string> = {};
  let batchFiles = 0;
  let batchBytes = 0;
  const flushBatch = () => {
    if (batchFiles === 0) {
      return;
    }

    batches.push(batch);

    batch = {};
    batchFiles = 0;
    batchBytes = 0;
  };

  for (const [filename, filepath] of entries) {
    const fileBytes = (await stat(filepath)).size;

    if (batchFiles >= MAX_UPLOAD_BATCH_FILES || (batchBytes > 0 && batchBytes + fileBytes > maxBytes)) {
      flushBatch();
    }

    batch[filename] = filepath;
    batchFiles += 1;
    batchBytes += fileBytes;
  }

  flushBatch();

  return batches;
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
  });
  const sendRequest =
    (method: "get" | "post" | "put" | "delete") =>
    async <T>(endpoint: string, payload?: AxiosRequestConfig & { params?: Record<string, any>; body?: any }) => {
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

        throw new UnknownError(errorMessage, err.stack);
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
  batchId: string,
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

      failedUploads.delete(batchId);

      return true;
    } catch (error) {
      if (uploadAbortController.signal.aborted) {
        return false;
      }

      failedUploads.add(batchId);

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
      addReportAsset: (payload: UploadReportFilePayload) => Promise<unknown>;
      addReportAssets?: (payload: { files: UploadReportFilePayload[]; signal?: AbortSignal }) => Promise<unknown>;
      addReportFile: (payload: UploadReportFilePayload & { reportUuid: string; pluginId?: string }) => Promise<string>;
      addReportFiles?: (payload: UploadReportFilesPayload) => Promise<Record<string, string>>;
    },
): Promise<UploadReportResult> => {
  const {
    reportUuid,
    pluginId,
    files,
    onProgress,
    uploadBatchMaxBytes,
    uploadConcurrency,
    uploadMaxAttempts,
    uploadMaxSimultaneousFailures,
  } = payload;
  let fileBatches: Record<string, string>[];

  if (uploadBatchMaxBytes === undefined) {
    fileBatches = Array.isArray(files) ? files.flatMap(createUploadFileBatches) : createUploadFileBatches(files);
  } else if (Array.isArray(files)) {
    fileBatches = (
      await Promise.all(files.map((fileBatch) => createUploadFileBatchesBySize(fileBatch, uploadBatchMaxBytes)))
    ).flat();
  } else {
    fileBatches = await createUploadFileBatchesBySize(files, uploadBatchMaxBytes);
  }

  if (fileBatches.length === 0) {
    return {
      hrefs: {},
    };
  }

  const uploadAbortController = new AbortController();
  const failedUploads = new Set<string>();
  const hrefs: Record<string, string> = {};
  let indexHref: string | undefined;
  let nextBatchIndex = 0;

  type UploadBatch = {
    batchId: string;
    kind: "report" | "asset";
    files: UploadReportFilePayload[];
  };

  const uploadBatches: UploadBatch[] = [];
  const canUploadReportFilesInBatch = !!payload.addReportFiles;
  const canUploadAssetsInBatch = !!payload.addReportAssets;

  for (const [batchIndex, batchFiles] of fileBatches.entries()) {
    const reportDataFiles: UploadReportFilePayload[] = [];
    const assetFiles: UploadReportFilePayload[] = [];

    for (const [filename, filepath] of Object.entries(batchFiles)) {
      const filePayload = { filename, filepath, signal: uploadAbortController.signal };

      if (isReportDataFile(filename)) {
        reportDataFiles.push(filePayload);
      } else {
        assetFiles.push(filePayload);
      }
    }

    if (reportDataFiles.length > 0) {
      if (canUploadReportFilesInBatch) {
        uploadBatches.push({
          batchId: `batch-${batchIndex}-report`,
          kind: "report",
          files: reportDataFiles,
        });
      } else {
        reportDataFiles.forEach((filePayload, fileIndex) => {
          uploadBatches.push({
            batchId: `batch-${batchIndex}-report-${fileIndex}`,
            kind: "report",
            files: [filePayload],
          });
        });
      }
    }

    if (assetFiles.length > 0) {
      if (canUploadAssetsInBatch) {
        uploadBatches.push({
          batchId: `batch-${batchIndex}-asset`,
          kind: "asset",
          files: assetFiles,
        });
      } else {
        assetFiles.forEach((filePayload, fileIndex) => {
          uploadBatches.push({
            batchId: `batch-${batchIndex}-asset-${fileIndex}`,
            kind: "asset",
            files: [filePayload],
          });
        });
      }
    }
  }

  const uploadFileBatch = async ({ kind, files: batchFiles }: UploadBatch): Promise<void> => {
    if (batchFiles.length === 0 || uploadAbortController.signal.aborted) {
      return;
    }

    if (kind === "report") {
      if (payload.addReportFiles) {
        const batchResult = await payload.addReportFiles({
          reportUuid,
          pluginId,
          files: batchFiles,
          signal: uploadAbortController.signal,
        });

        for (const [filename, fileUrl] of Object.entries(batchResult)) {
          hrefs[filename] = fileUrl;

          if (filename === "index.html") {
            indexHref = fileUrl;
          }
        }
      } else {
        for (const filePayload of batchFiles) {
          const fileUrl = await payload.addReportFile({
            reportUuid,
            pluginId,
            ...filePayload,
          });

          hrefs[filePayload.filename] = fileUrl;

          if (filePayload.filename === "index.html") {
            indexHref = fileUrl;
          }
        }
      }
    } else if (payload.addReportAssets) {
      await payload.addReportAssets({
        files: batchFiles,
        signal: uploadAbortController.signal,
      });
    } else {
      for (const filePayload of batchFiles) {
        await payload.addReportAsset(filePayload);
      }
    }

    onProgress?.(batchFiles.length);
  };
  const uploadNext = async (): Promise<void> => {
    while (!uploadAbortController.signal.aborted) {
      const batchIndex = nextBatchIndex++;

      if (batchIndex >= uploadBatches.length) {
        return;
      }

      const batch = uploadBatches[batchIndex];
      const uploaded = await uploadWithRetry(
        batch.batchId,
        uploadAbortController,
        failedUploads,
        uploadMaxAttempts,
        uploadMaxSimultaneousFailures,
        async () => uploadFileBatch(batch),
      );

      if (!uploaded || uploadAbortController.signal.aborted) {
        return;
      }
    }
  };

  const uploadTasks = Array.from({ length: Math.min(uploadConcurrency, uploadBatches.length) }, () => uploadNext());

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
