import { join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint } from "@allurereport/core-api";

import {
  ALLURE_SERVICE_STORAGE_PREFIX,
  type AllureServiceApiClient,
  type AllureServiceApiClientConfig,
  type UploadReportFilePayload,
  type UploadReportFilesPayload,
  type UploadReportPayload,
} from "./model.js";
import { type HttpClient, createServiceHttpClient, uploadReport } from "./utils/http.js";
import { parseServiceToken } from "./utils/token.js";
import { createUploadForm } from "./utils/upload.js";

const UPLOAD_CONTENT_TYPE = "application/octet-stream";

const createUploadBlob = (content: Buffer) => new Blob([content], { type: UPLOAD_CONTENT_TYPE });

const createReportUrl = (baseUrl: string, reportUuid: string) => `${baseUrl}/${reportUuid}`;

const createReportFileUrl = (baseUrl: string, reportUuid: string, reportFilename: string) =>
  `${baseUrl}/${joinPosix(reportUuid, reportFilename)}`;

export class AllureServiceClient implements AllureServiceApiClient {
  readonly #client: HttpClient;
  readonly #url: string;

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
        limit: limit ? encodeURIComponent(limit) : undefined,
        repo: repo ? encodeURIComponent(repo) : undefined,
        branch: branch ? encodeURIComponent(branch) : undefined,
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

    return this.#client.post(`/api/reports/${reportUuid}/complete`, {
      body: {
        historyPoint: completedHistoryPoint,
      },
    });
  }

  /**
   * Entirely deletes a report by its UUID with all the uploaded files
   * If plugin id is provided, delete report for the plugin only
   * @param payload
   */
  async deleteReport(payload: { reportUuid: string; pluginId?: string }) {
    const { reportUuid, pluginId = "" } = payload;

    return this.#client.post(`/api/report/${reportUuid}/delete`, {
      body: {
        pluginId,
      },
    });
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
    return this.addReportAssets({ files: [payload], ...(payload.signal ? { signal: payload.signal } : {}) });
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
    const result = await this.addReportFiles({
      reportUuid: payload.reportUuid,
      pluginId: payload.pluginId,
      files: [payload],
      ...(payload.signal ? { signal: payload.signal } : {}),
    });

    return result[payload.filename];
  }

  async uploadReport(payload: UploadReportPayload) {
    const { uploadBatchMaxBytes: _uploadBatchMaxBytes, ...uploadPayload } = payload;

    return uploadReport({
      ...uploadPayload,
      uploadConcurrency: this.config.uploadConcurrency,
      uploadMaxAttempts: this.config.uploadMaxAttempts,
      uploadMaxSimultaneousFailures: this.config.uploadMaxSimultaneousFailures,
      addReportAsset: this.addReportAsset.bind(this),
      addReportAssets: this.addReportAssets.bind(this),
      addReportFile: this.addReportFile.bind(this),
      addReportFiles: this.addReportFiles.bind(this),
    });
  }
}
