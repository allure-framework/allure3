import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";

import type { AllureServiceApiClient } from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";

const ASSET_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const UPLOAD_CONTENT_TYPE = "application/octet-stream";

const createUploadBlob = (content: Buffer) => new Blob([content], { type: UPLOAD_CONTENT_TYPE });
const createReportFileUrl = (reportUrl: URL, reportFilename: string) => {
  const fileUrl = new URL(reportUrl);

  fileUrl.pathname = joinPosix(fileUrl.pathname, reportFilename);
  fileUrl.search = "";
  fileUrl.hash = "";

  return fileUrl.toString();
};
const createFallbackReportUrl = (baseUrl: string, reportUuid: string) => {
  const reportUrl = new URL(`${baseUrl}/`);

  reportUrl.pathname = joinPosix(reportUrl.pathname, reportUuid);

  return reportUrl;
};

export class AllureLegacyServiceClient implements AllureServiceApiClient {
  readonly #client: HttpClient;
  readonly #url: string;
  #reportUrl: URL | undefined;

  constructor(readonly config: Config["allureService"]) {
    if (!config?.accessToken) {
      throw new Error("Allure service access token is required");
    }

    const { url } = JSON.parse(atob(config.accessToken.split(".")[1])) as { url: string };

    this.#url = url.replace(/\/$/, "");
    this.#client = createServiceHttpClient(this.#url, config.accessToken);
  }

  async downloadHistory(payload: { repo?: string; branch?: string; limit?: number }) {
    const { branch, limit } = payload ?? {};
    const { history } = await this.#client.get<{ history: HistoryDataPoint[] }>("/projects/history", {
      params: {
        limit: limit ? encodeURIComponent(limit) : undefined,
        branch: branch ? encodeURIComponent(branch) : undefined,
      },
    });

    return history;
  }

  async createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }) {
    const { reportName, reportUuid, branch } = payload;
    const { url } = await this.#client.post<{ url: string }>("/reports", {
      body: {
        reportName,
        reportUuid,
        branch,
      },
    });

    this.#reportUrl = new URL(url);

    return this.#reportUrl;
  }

  async completeReport(payload: { reportUuid: string; historyPoint: HistoryDataPoint }) {
    const { reportUuid, historyPoint } = payload;

    return this.#client.post(`/reports/${reportUuid}/complete`, {
      body: {
        historyPoint,
      },
    });
  }

  async deleteReport(payload: { reportUuid: string; pluginId?: string }) {
    const { reportUuid, pluginId = "" } = payload;

    return this.#client.post(`/reports/${reportUuid}/delete`, {
      body: {
        pluginId,
      },
    });
  }

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

    return this.#client.post("/assets/upload", {
      body: form,
      headers: { "Content-Type": "multipart/form-data" },
      ...(signal ? { signal } : {}),
    });
  }

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

    await this.#client.post(`/reports/${reportUuid}/upload`, {
      body: form,
      headers: { "Content-Type": "multipart/form-data" },
      ...(signal ? { signal } : {}),
    });

    return createReportFileUrl(this.#reportUrl ?? createFallbackReportUrl(this.#url, reportUuid), reportFilename);
  }
}
