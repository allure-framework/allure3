import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";

const ASSET_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export class AllureServiceClient {
  readonly #client: HttpClient;
  readonly #url: string;

  constructor(readonly config: Config["allureService"]) {
    if (!config?.accessToken) {
      throw new Error("Allure service access token is required");
    }

    const { iss, projectId, url: baseUrl } = this.decodeToken(config.accessToken) ?? {};

    if (iss !== "allure-service" || !baseUrl || !projectId) {
      throw new Error("Invalid access token");
    }

    this.#url = baseUrl;
    this.#client = createServiceHttpClient(this.#url, config.accessToken);
  }

  decodeToken(token: string) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

      return JSON.parse(atob(base64));
    } catch {
      return undefined;
    }
  }

  /**
   * Returns user profile and current project
   */
  async profile() {
    const { user, project } = await this.#client.get<{ user: { email: string }; project: any }>("/user/profile");

    return {
      user,
      project,
    };
  }

  /**
   * Genereates a new access token for the specific project and returns it
   * @param projectUuid
   */
  async generateNewAccessToken(projectUuid: string) {
    const { accessToken } = await this.#client.post<{ accessToken: string }>("/auth/tokens", {
      body: {
        projectId: projectUuid,
      },
    });

    return accessToken;
  }

  /**
   * Returns list of all projects
   */
  async projects() {
    return this.#client.get<{ projects: { id: string; name: string }[] }>("/projects");
  }

  /**
   * Returns specific project by UUID
   */
  async project(uuid: string) {
    return this.#client.get<{ project: { id: string; name: string } }>(`/projects/${uuid}`);
  }

  /**
   * Downloads history data for a specific branch
   * @param payload
   */
  async downloadHistory(payload: { branch?: string; limit?: number }) {
    const { branch, limit } = payload ?? {};
    const params = new URLSearchParams();

    if (limit) {
      params.append("limit", encodeURIComponent(limit));
    }

    if (branch) {
      params.append("branch", encodeURIComponent(branch));
    }

    const { history } = await this.#client.get<{ history: HistoryDataPoint[] }>(
      params.size > 0 ? `/projects/history?${params.toString()}` : "/projects/history",
    );

    return history;
  }

  /**
   * Creates a new report and returns the URL
   * @param payload
   */
  async createReport(payload: { reportName: string; reportUuid?: string; branch?: string }) {
    const { reportName, reportUuid, branch } = payload;

    return this.#client.post<{ url: string }>("/reports", {
      body: {
        reportName,
        reportUuid,
        branch,
      },
    });
  }

  /**
   * Marks report as a completed one and assigns history data point to it
   * Incompleted reports don't appear in the history
   * Use when all report files have been uploaded
   * @param payload
   */
  async completeReport(payload: { reportUuid: string; historyPoint: HistoryDataPoint }) {
    const { reportUuid, historyPoint } = payload;

    return this.#client.post(`/reports/${reportUuid}/complete`, {
      body: {
        historyPoint,
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

    return this.#client.post(`/reports/${reportUuid}/delete`, {
      body: {
        pluginId,
      },
    });
  }

  /**
   * Uploads report asset which can be shared between multiple reports at once
   * @param payload
   */
  async addReportAsset(payload: { filename: string; file?: Buffer; filepath?: string }) {
    const { filename, file, filepath } = payload;

    if (!file && !filepath) {
      throw new Error("File or filepath is required");
    }

    let content = file;

    if (!content) {
      content = await readFile(filepath!);
    }

    if (content.length > ASSET_MAX_FILE_SIZE) {
      throw new Error(`Asset size exceeds the maximum allowed size of ${ASSET_MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const form = new FormData();

    form.set("filename", filename);
    form.set("file", content);

    return this.#client.post("/assets/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
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
  }) {
    const { reportUuid, filename, file, filepath, pluginId } = payload;

    if (!file && !filepath) {
      throw new Error("File or filepath is required");
    }

    let content = file;

    if (!content) {
      content = await readFile(filepath!);
    }

    if (content.length > ASSET_MAX_FILE_SIZE) {
      throw new Error(`Report file size exceeds the maximum allowed size of ${ASSET_MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const form = new FormData();

    form.set("filename", pluginId ? joinPosix(pluginId, filename) : filename);
    form.set("file", content);

    await this.#client.post(`/reports/${reportUuid}/upload`, {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return joinPosix(this.#url, reportUuid, filename);
  }
}
