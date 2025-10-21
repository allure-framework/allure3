import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import open from "open";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";
import { decryptExchangeToken, deleteAccessToken, writeAccessToken, writeExchangeToken } from "./utils/token.js";

const ASSET_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export class AllureServiceClient {
  readonly #client: HttpClient;
  readonly #url: string;
  readonly #pollingDelay: number;
  currentProjectUuid: string | undefined;

  constructor(readonly config: Config["allureService"] & { pollingDelay?: number }) {
    if (!config.url) {
      throw new Error("Allure service URL is required!");
    }

    this.#url = config.url;
    this.#client = createServiceHttpClient(this.#url, config?.accessToken);
    this.#pollingDelay = config?.pollingDelay ?? 2500;
    this.currentProjectUuid = config?.project;
  }

  setProject(project: string) {
    this.currentProjectUuid = project;
  }

  async #getClientUrl() {
    const { url } = await this.#client.get<{ url: string }>("/info");

    return url;
  }

  /**
   * Exchanges the exchange token for an access token
   */
  async login(): Promise<any> {
    const clientUrl = await this.#getClientUrl();
    const exchangeToken = await writeExchangeToken();
    const connectUrl = new URL("/connect", clientUrl);

    connectUrl.searchParams.set("token", decryptExchangeToken(exchangeToken));

    await open(connectUrl.toString());

    let currentExchangeAttemptTimeout: NodeJS.Timeout | undefined;

    return await new Promise((res) => {
      const makeExchangeAttempt = (): NodeJS.Timeout => {
        return globalThis.setTimeout(async () => {
          const token = decryptExchangeToken(exchangeToken);
          const { accessToken } = await this.#client.post<{ accessToken: string }>("/auth/exchange", {
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              token,
            },
          });

          if (!accessToken) {
            globalThis.clearTimeout(currentExchangeAttemptTimeout);
            currentExchangeAttemptTimeout = makeExchangeAttempt();
            return;
          }

          await writeAccessToken(accessToken);

          return res(accessToken);
        }, this.#pollingDelay);
      };

      currentExchangeAttemptTimeout = makeExchangeAttempt();
    });
  }

  /**
   * Deletes the access token preventing further requests
   */
  async logout() {
    await deleteAccessToken();
  }

  /**
   * Returns user profile
   */
  async profile() {
    const { user } = await this.#client.get<{ user: { email: string } }>("/user/profile");

    return user;
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
   * Creates a new project
   * @param payload
   */
  async createProject(payload: { name: string }) {
    const { project } = await this.#client.post<{ project: { id: string; name: string } }>("/projects", {
      body: payload,
    });

    return project;
  }

  /**
   * Deletes a project
   * @param payload
   */
  async deleteProject(payload: { id: string }) {
    return this.#client.delete(`/projects/${payload.id}`);
  }

  /**
   * Downloads history data for a specific branch
   * @param payload
   */
  async downloadHistory(branch: string) {
    if (!this.currentProjectUuid) {
      throw new Error("Project is not set");
    }

    const { history } = await this.#client.get<{ history: HistoryDataPoint[] }>(
      `/projects/${this.currentProjectUuid}/${branch}/history`,
    );

    return history;
  }

  /**
   * Creates a new report and returns the URL
   * @param payload
   */
  async createReport(payload: { reportName: string; reportUuid?: string; branch?: string }) {
    const { reportName, reportUuid, branch } = payload;

    if (!this.currentProjectUuid) {
      throw new Error("Project is not set");
    }

    return this.#client.post<{ url: string }>("/reports", {
      body: {
        projectUuid: this.currentProjectUuid,
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

    if (!this.currentProjectUuid) {
      throw new Error("Project is not set");
    }

    return this.#client.post(`/reports/${reportUuid}/complete`, {
      body: {
        historyPoint,
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
    pluginId: string;
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

    form.set("filename", joinPosix(pluginId, filename));
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
