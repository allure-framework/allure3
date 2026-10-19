import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint, parseIntegerConfigValue } from "@allurereport/core-api";

import {
  ALLURE_SERVICE_STORAGE_PREFIX,
  type AllureServiceApiClient,
  type AllureServiceApiClientConfig,
  type UploadReportFilePayload,
  type UploadReportFilesPayload,
  type UploadReportPayload,
} from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";
import { type StorageUploadFile, encodeUploadPath, normalizeUploadPath, uploadStorageReport } from "./utils/storage.js";
import { parseServiceToken } from "./utils/token.js";
import { createUploadForm } from "./utils/upload.js";

const UPLOAD_CONTENT_TYPE = "application/octet-stream";

const createUploadBlob = (content: Buffer) => new Blob([content], { type: UPLOAD_CONTENT_TYPE });

const createReportUrl = (baseUrl: string, reportUuid: string) => `${baseUrl}/${reportUuid}`;

const createReportFileUrl = (baseUrl: string, reportUuid: string, reportFilename: string) =>
  `${baseUrl}/${joinPosix(reportUuid, reportFilename)}`;

const resolveUploadConcurrency = (value: number | undefined) => {
  const concurrency = parseIntegerConfigValue(value) ?? 10;

  if (concurrency <= 0) {
    throw new Error(
      `Allure service upload concurrency must resolve to an integer greater than 0; received ${String(value)}`,
    );
  }

  return concurrency;
};

export class AllureServiceClient implements AllureServiceApiClient {
  readonly #client: HttpClient;
  readonly #url: string;
  readonly #uploadedAssets = new Map<string, Set<string>>();

  constructor(readonly config: AllureServiceApiClientConfig) {
    if (!config?.accessToken) {
      throw new Error("Allure service access token is required");
    }

    if (!config.accessToken.startsWith(ALLURE_SERVICE_STORAGE_PREFIX)) {
      throw new Error("Allure service access token is invalid");
    }

    const { url } = parseServiceToken(config.accessToken);

    this.#url = url.replace(/\/$/, "");
    this.#client = createServiceHttpClient(this.#url, {
      accessToken: config.accessToken,
    });
  }

  /**
   * Downloads history data for a specific repository branch
   * @param payload
   */
  async downloadHistory(payload: { repo?: string; branch?: string; limit?: number }) {
    const { repo, branch, limit } = payload ?? {};
    const { history } = await this.#client.get<{ history: HistoryDataPoint[] }>("/api/history", {
      params: {
        limit,
        repo,
        branch,
      },
    });

    return history;
  }

  /**
   * Creates a new report and returns the URL
   * @param payload
   */
  async createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }) {
    const { reportName, reportUuid, repo, branch } = payload;
    const { url } = await this.#client.post<{ url: string }>("/api/reports", {
      body: {
        reportName,
        reportUuid,
        repo,
        branch,
      },
    });

    return new URL(url, this.#url);
  }

  /**
   * Marks report as a completed one and assigns history data point to it
   * Incompleted reports don't appear in the history
   * Use when all report files have been uploaded
   * @param payload
   */
  async completeReport(payload: { reportUuid: string; historyPoint: HistoryDataPoint }) {
    const { reportUuid, historyPoint } = payload;
    const completedHistoryPoint = {
      ...historyPoint,
      url: createReportUrl(this.#url, reportUuid),
    };

    try {
      return await this.#client.post(`/api/reports/${reportUuid}/complete`, {
        body: {
          historyPoint: completedHistoryPoint,
        },
      });
    } finally {
      this.#uploadedAssets.delete(reportUuid);
    }
  }

  /**
   * Entirely deletes a report by its UUID with all the uploaded files
   * If plugin id is provided, delete report for the plugin only
   * @param payload
   */
  async deleteReport(payload: { reportUuid: string; pluginId?: string }) {
    const { reportUuid, pluginId = "" } = payload;

    try {
      return await this.#client.post(`/api/report/${reportUuid}/delete`, {
        body: {
          pluginId,
        },
      });
    } finally {
      this.#uploadedAssets.delete(reportUuid);
    }
  }

  async #uploadRawFile(
    payload: UploadReportFilePayload & {
      endpoint: string;
      remotePath: string;
      size?: number;
    },
  ) {
    const { endpoint, remotePath, file, filepath, signal } = payload;

    if (file === undefined && !filepath) {
      throw new Error("File or filepath is required");
    }

    const size = payload.size ?? (file !== undefined ? file.length : (await stat(filepath!)).size);
    const body = file ?? createReadStream(filepath!, { signal });

    try {
      return await this.#client.put(`${endpoint}?path=${encodeUploadPath(remotePath)}`, {
        body,
        headers: {
          "Content-Length": size,
          "Content-Type": UPLOAD_CONTENT_TYPE,
        },
        maxBodyLength: Number.POSITIVE_INFINITY,
        maxContentLength: Number.POSITIVE_INFINITY,
        ...(signal ? { signal } : {}),
      });
    } finally {
      if (!Buffer.isBuffer(body)) {
        body.destroy();
      }
    }
  }

  async #uploadPreparedFile(reportUuid: string, file: StorageUploadFile, signal: AbortSignal) {
    const endpoint = file.kind === "report" ? `/api/reports/${reportUuid}/files` : "/api/assets";

    await this.#uploadRawFile({
      ...file,
      endpoint,
      remotePath: file.remotePath,
      signal,
    });

    return file.kind === "report" ? createReportFileUrl(this.#url, reportUuid, file.remotePath) : undefined;
  }

  /**
   * Uploads report asset which can be shared between multiple reports at once
   * @param payload
   */
  async addReportAssets(payload: { files: UploadReportFilePayload[]; signal?: AbortSignal }) {
    const { files, signal } = payload;

    if (files.length === 0) {
      return undefined;
    }

    const { form } = await createUploadForm(files, createUploadBlob, signal);

    return this.#client.post("/api/assets/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });
  }

  async addReportAsset(payload: UploadReportFilePayload) {
    const remotePath = normalizeUploadPath(payload.filename);

    return this.#uploadRawFile({
      ...payload,
      endpoint: "/api/assets",
      remotePath,
    });
  }

  /**
   * Adds a file to an existing report
   * If the report doesn't exist, it will be created
   * @param payload
   */
  async addReportFiles(payload: UploadReportFilesPayload) {
    const { reportUuid, pluginId, files, signal } = payload;

    if (files.length === 0) {
      return {};
    }

    const { entries, form } = await createUploadForm(files, createUploadBlob, signal, (filename) =>
      pluginId ? joinPosix(pluginId, filename) : filename,
    );

    await this.#client.post(`/api/reports/${reportUuid}/upload`, {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });

    return Object.fromEntries(
      entries.map(({ filename, reportFilename }) => [
        filename,
        createReportFileUrl(this.#url, reportUuid, reportFilename),
      ]),
    );
  }

  async addReportFile(payload: UploadReportFilePayload & { reportUuid: string; pluginId?: string }) {
    const filename = normalizeUploadPath(payload.filename);
    const remotePath = payload.pluginId ? `${normalizeUploadPath(payload.pluginId)}/${filename}` : filename;

    await this.#uploadRawFile({
      ...payload,
      endpoint: `/api/reports/${payload.reportUuid}/files`,
      remotePath,
    });

    return createReportFileUrl(this.#url, payload.reportUuid, remotePath);
  }

  async uploadReport(payload: UploadReportPayload) {
    const uploadedAssets = this.#uploadedAssets.get(payload.reportUuid) ?? new Set<string>();

    this.#uploadedAssets.set(payload.reportUuid, uploadedAssets);

    return uploadStorageReport({
      ...payload,
      uploadConcurrency: resolveUploadConcurrency(this.config.uploadConcurrency),
      uploadMaxAttempts: this.config.uploadMaxAttempts,
      uploadMaxSimultaneousFailures: this.config.uploadMaxSimultaneousFailures,
      uploadedAssets,
      upload: (file, signal) => this.#uploadPreparedFile(payload.reportUuid, file, signal),
    });
  }
}
