import { readFile } from "node:fs/promises";
import { extname, join as joinPosix } from "node:path/posix";

import { type HistoryDataPoint } from "@allurereport/core-api";

import {
  ALLURE_SERVICE_TESTOPS_PREFIX,
  type AllureServiceApiClient,
  type AllureServiceApiClientConfig,
  type UploadReportPayload,
} from "./model.js";
import { type HttpClient, createServiceHttpClient, uploadReport } from "./utils/http.js";
import { parseServiceToken } from "./utils/token.js";

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

const contentTypeByFilename = (filename: string) => CONTENT_TYPES[extname(filename)] ?? DEFAULT_UPLOAD_CONTENT_TYPE;

const createUploadBlob = (content: Buffer, filename: string) =>
  new Blob([content], { type: contentTypeByFilename(filename) });

const createReportFileUrl = (baseUrl: string, reportUuid: string, reportFilename: string) =>
  `${baseUrl}/api/test-report/view/${joinPosix(reportUuid, reportFilename)}`;

export class AllureTestOpsClient implements AllureServiceApiClient {
  readonly #url: string;
  readonly #accessToken: string;
  readonly #projectId: number;
  #client?: HttpClient;

  constructor(readonly config: AllureServiceApiClientConfig) {
    if (!config?.accessToken) {
      throw new Error("Allure TestOps access token is required");
    }

    if (!config.accessToken.startsWith(ALLURE_SERVICE_TESTOPS_PREFIX)) {
      throw new Error("Allure service access token is invalid");
    }

    const accessTokenPayload = parseServiceToken<{ projectId: number | string }>(config.accessToken);
    const projectId = Number(accessTokenPayload.projectId);

    if (!Number.isFinite(projectId)) {
      throw new Error("Given access token doesn't contain project id");
    }

    if (!accessTokenPayload.url) {
      throw new Error("Given access token doesn't contain url");
    }

    this.#accessToken = accessTokenPayload.accessToken;
    this.#projectId = projectId;
    this.#url = accessTokenPayload.url.replace(/\/$/, "");
  }

  async #authorizedClient() {
    if (this.#client) {
      return this.#client;
    }

    this.#client = createServiceHttpClient(this.#url, {
      apiToken: this.#accessToken,
    });

    return this.#client;
  }

  async downloadHistory(): Promise<HistoryDataPoint[]> {
    return [];
  }

  async createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }) {
    const client = await this.#authorizedClient();
    const { reportName, reportUuid } = payload;
    const { url } = await client.post<{ url: string }>("/api/test-report", {
      body: {
        projectId: this.#projectId,
        isPublic: !this.config?.private,
        reportName,
        reportUuid,
      },
    });

    return new URL(url, this.#url);
  }

  async completeReport(payload: { reportUuid: string; historyPoint?: HistoryDataPoint }) {
    const client = await this.#authorizedClient();
    const { reportUuid } = payload;

    return client.post(`/api/test-report/${reportUuid}/complete`);
  }

  async deleteReport(payload: { reportUuid: string; pluginId?: string }) {
    const client = await this.#authorizedClient();
    const { reportUuid } = payload;

    return client.delete(`/api/test-report/${reportUuid}`);
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

    const form = new FormData();

    form.set("filename", filename);
    form.set("file", createUploadBlob(content, filename), filename);

    const client = await this.#authorizedClient();

    return client.post("/api/test-report/upload", {
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

    const form = new FormData();

    form.set("filename", reportFilename);
    form.set("file", createUploadBlob(content, reportFilename), reportFilename);

    const client = await this.#authorizedClient();

    await client.post(`/api/test-report/${reportUuid}/upload`, {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });

    return createReportFileUrl(this.#url, reportUuid, reportFilename);
  }

  async uploadReport(payload: UploadReportPayload) {
    return uploadReport({
      ...payload,
      uploadConcurrency: this.config.uploadConcurrency,
      uploadMaxAttempts: this.config.uploadMaxAttempts,
      uploadMaxSimultaneousFailures: this.config.uploadMaxSimultaneousFailures,
      addReportAsset: this.addReportAsset.bind(this),
      addReportFile: this.addReportFile.bind(this),
    });
  }
}
