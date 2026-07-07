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
const UPLOAD_BATCH_MAX_BYTES = 8 * 1024 * 1024;
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

const readUploadContent = async (payload: { file?: Buffer; filepath?: string; signal?: AbortSignal }) => {
  const { file, filepath, signal } = payload;

  if (file) {
    return file;
  }

  if (!filepath) {
    throw new Error("File or filepath is required");
  }

  return signal ? readFile(filepath, { signal }) : readFile(filepath);
};

const createUploadForm = async (
  files: { filename: string; file?: Buffer; filepath?: string; signal?: AbortSignal }[],
  signal?: AbortSignal,
  mapFilename?: (filename: string) => string,
) => {
  const entries = await Promise.all(
    files.map(async ({ filename, ...filePayload }) => {
      const uploadFilename = mapFilename ? mapFilename(filename) : filename;

      return {
        filename,
        uploadFilename,
        content: await readUploadContent({ ...filePayload, signal: signal ?? filePayload.signal }),
      };
    }),
  );
  const form = new FormData();

  for (const { uploadFilename, content } of entries) {
    form.append("filename", uploadFilename);
    form.append("file", createUploadBlob(content, uploadFilename), uploadFilename);
  }

  return { entries, form };
};

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
    const { file, filepath, filename, signal } = payload;
    const { form } = await createUploadForm([{ filename, file, filepath, signal }], signal);
    const client = await this.#authorizedClient();

    return client.post("/api/test-report/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...(signal ? { signal } : {}),
    });
  }

  async addReportAssets(payload: {
    files: { filename: string; file?: Buffer; filepath?: string; signal?: AbortSignal }[];
    signal?: AbortSignal;
  }) {
    const { files, signal } = payload;

    if (files.length === 0) {
      return undefined;
    }

    const { form } = await createUploadForm(files, signal);
    const client = await this.#authorizedClient();

    return client.post("/api/test-report/upload/batch", {
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
    const { reportUuid, pluginId, filename, file, filepath, signal } = payload;
    const reportFilename = pluginId ? joinPosix(pluginId, filename) : filename;
    const { form } = await createUploadForm([{ filename, file, filepath, signal }], signal, () => reportFilename);
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

  async addReportFiles(payload: {
    reportUuid: string;
    pluginId?: string;
    files: { filename: string; file?: Buffer; filepath?: string; signal?: AbortSignal }[];
    signal?: AbortSignal;
  }) {
    const { reportUuid, pluginId, files, signal } = payload;

    if (files.length === 0) {
      return {};
    }

    const entries = await Promise.all(
      files.map(async ({ filename, ...filePayload }) => {
        const reportFilename = pluginId ? joinPosix(pluginId, filename) : filename;

        return {
          filename,
          reportFilename,
          content: await readUploadContent({ ...filePayload, signal: signal ?? filePayload.signal }),
        };
      }),
    );
    const form = new FormData();

    for (const { reportFilename, content } of entries) {
      form.append("filename", reportFilename);
      form.append("file", createUploadBlob(content, reportFilename), reportFilename);
    }

    const client = await this.#authorizedClient();

    await client.post(`/api/test-report/${reportUuid}/upload/batch`, {
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

  async uploadReport(payload: UploadReportPayload) {
    return uploadReport({
      ...payload,
      uploadConcurrency: this.config.uploadConcurrency,
      uploadMaxAttempts: this.config.uploadMaxAttempts,
      uploadMaxSimultaneousFailures: this.config.uploadMaxSimultaneousFailures,
      uploadBatchMaxBytes: UPLOAD_BATCH_MAX_BYTES,
      addReportAsset: this.addReportAsset.bind(this),
      addReportAssets: this.addReportAssets.bind(this),
      addReportFile: this.addReportFile.bind(this),
      addReportFiles: this.addReportFiles.bind(this),
    });
  }
}
