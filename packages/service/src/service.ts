import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";

import { type HttpClient, createServiceHttpClient } from "./utils/http.js";

const ASSET_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const UPLOAD_CONTENT_TYPE = "application/octet-stream";

const createUploadBlob = (content: Buffer) => new Blob([content], { type: UPLOAD_CONTENT_TYPE });
const createReportUrl = (baseUrl: string, reportUuid: string) => `${baseUrl}/${reportUuid}`;
const createReportFileUrl = (baseUrl: string, reportUuid: string, reportFilename: string) =>
  `${baseUrl}/${joinPosix(reportUuid, reportFilename)}`;

export class AllureServiceClient {
  readonly #client: HttpClient;
  readonly #url: string;

  constructor(readonly config: Config["allureService"]) {
    if (!config?.url) {
      throw new Error("Allure service URL is required");
    }

    if (!config?.accessToken) {
      throw new Error("Allure service access token is required");
    }

    this.#url = config.url.replace(/\/$/, "");
    this.#client = createServiceHttpClient(this.#url, config.accessToken);
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

    return this.#client.post(`/api/reports/${reportUuid}/delete`, {
      body: {
        pluginId,
      },
    });
  }

  /**
   * Uploads report asset which can be shared between multiple reports at once
   * @param payload
   */
  async addReportAsset(payload: { filename: string; file?: Buffer; filepath?: string; signal?: AbortSignal }) {
    const { filename, file, filepath, signal } = payload;

    if (!file && !filepath) {
      throw new Error("File or filepath is required");
    }

    let content = file;

    if (!content) {
      content = signal ? await readFile(filepath!, { signal }) : await readFile(filepath!);
    }

    if (content.length > ASSET_MAX_FILE_SIZE) {
      throw new Error(`Asset size exceeds the maximum allowed size of ${ASSET_MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const form = new FormData();

    form.set("filename", filename);
    form.set("file", createUploadBlob(content), filename);

    return this.#client.post("/api/assets/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });
  }

  /**
   * Adds a file to an existing report
   * If the report doesn't exist, it will be created
   * @param payload
   */
  async addReportFile(payload: {
    reportUuid: string;
    pluginId?: string;
    filename: string;
    file?: Buffer;
    filepath?: string;
    signal?: AbortSignal;
  }) {
    const { reportUuid, filename, file, filepath, pluginId, signal } = payload;
    const reportFilename = pluginId ? joinPosix(pluginId, filename) : filename;

    if (!file && !filepath) {
      throw new Error("File or filepath is required");
    }

    let content = file;

    if (!content) {
      content = signal ? await readFile(filepath!, { signal }) : await readFile(filepath!);
    }

    if (content.length > ASSET_MAX_FILE_SIZE) {
      throw new Error(`Report file size exceeds the maximum allowed size of ${ASSET_MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const form = new FormData();

    form.set("filename", reportFilename);
    form.set("file", createUploadBlob(content), reportFilename);

    await this.#client.post(`/api/reports/${reportUuid}/upload`, {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });

    return createReportFileUrl(this.#url, reportUuid, reportFilename);
  }
}
