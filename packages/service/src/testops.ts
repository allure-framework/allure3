import { readFile } from "node:fs/promises";
import { extname, join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint } from "@allurereport/core-api";

import type { AllureServiceApiClient } from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";

const ASSET_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const DEFAULT_UPLOAD_CONTENT_TYPE = "application/octet-stream";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "application/javascript",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface AllureTestOpsClientConfig {
  accessToken?: string;
  baseUrl?: string;
  projectId: number | string;
  isPublic?: boolean;
}

const contentTypeByFilename = (filename: string) => CONTENT_TYPES[extname(filename)] ?? DEFAULT_UPLOAD_CONTENT_TYPE;
const createUploadBlob = (content: Buffer, filename: string) =>
  new Blob([content], { type: contentTypeByFilename(filename) });
const createReportFileUrl = (baseUrl: string, reportUuid: string, reportFilename: string) =>
  `${baseUrl}/api/test-report/view/${joinPosix(reportUuid, reportFilename)}`;

export class AllureTestOpsClient implements AllureServiceApiClient {
  readonly #url: string;
  readonly #projectId: number;
  #client: HttpClient;

  constructor(readonly config: AllureTestOpsClientConfig) {
    if (!config?.accessToken) {
      throw new Error("Allure TestOps access token is required");
    }

    const projectId = Number(config.projectId);

    if (!Number.isFinite(projectId)) {
      throw new Error("Allure TestOps project ID is required");
    }

    if (!config.baseUrl) {
      throw new Error("Allure TestOps endpoint is required");
    }

    this.#projectId = projectId;
    this.#url = config.baseUrl.replace(/\/$/, "");
    this.#client = createServiceHttpClient(this.#url, {
      apiToken: config.accessToken,
    });
  }

  async downloadHistory(): Promise<HistoryDataPoint[]> {
    return [];
  }

  async createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }) {
    const { reportName, reportUuid } = payload;
    const { isPublic } = this.config;
    const { url } = await this.#client.post<{ url: string }>("/api/test-report", {
      body: {
        projectId: this.#projectId,
        reportName,
        reportUuid,
        isPublic,
      },
    });

    return new URL(url, this.#url);
  }

  async completeReport(payload: { reportUuid: string; historyPoint?: HistoryDataPoint }) {
    const { reportUuid } = payload;

    return this.#client.post(`/api/test-report/${reportUuid}/complete`);
  }

  async deleteReport(payload: { reportUuid: string; pluginId?: string }) {
    const { reportUuid } = payload;

    return this.#client.delete(`/api/test-report/${reportUuid}`);
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
    form.set("file", createUploadBlob(content, filename), filename);

    return this.#client.post("/api/test-report/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
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
    form.set("file", createUploadBlob(content, reportFilename), reportFilename);

    await this.#client.post(`/api/test-report/${reportUuid}/upload`, {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });

    return createReportFileUrl(this.#url, reportUuid, reportFilename);
  }
}
