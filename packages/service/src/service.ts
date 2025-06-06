import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import open from "open";
import { DEFAULT_HISTORY_SERVICE_URL } from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";
import { decryptExchangeToken, deleteAccessToken, writeAccessToken, writeExchangeToken } from "./utils/token.js";

export class AllureService {
  readonly #client: HttpClient;
  readonly #url: string;
  readonly #pollingDelay: number;
  project: string | undefined;

  constructor(readonly config: Config["allureService"] & { pollingDelay?: number }) {
    this.#url = config?.url ?? DEFAULT_HISTORY_SERVICE_URL;
    this.#client = createServiceHttpClient(this.#url, config?.accessToken);
    this.#pollingDelay = config?.pollingDelay ?? 2500;
    this.project = config?.project;
  }

  setProject(project: string) {
    this.project = project;
  }

  /**
   * Exchanges the exchange token for an access token
   */
  async login(): Promise<string> {
    const exchangeToken = await writeExchangeToken();
    const connectUrl = new URL("/connect", this.#url);

    connectUrl.searchParams.set("token", decryptExchangeToken(exchangeToken));

    await open(connectUrl.toString());

    let currentExchangeAttemptTimeout: NodeJS.Timeout | undefined;

    return await new Promise((res) => {
      const makeExchangeAttempt = (): NodeJS.Timeout => {
        return globalThis.setTimeout(async () => {
          const token = decryptExchangeToken(exchangeToken);
          const { accessToken } = await this.#client.post<{ accessToken: string }>("/api/auth/tokens/exchange", {
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
    return this.#client.get<{ email: string }>("/api/user/profile");
  }

  /**
   * Returns list of all projects
   */
  async projects() {
    return this.#client.get<{ id: string; name: string }[]>("/api/projects/list");
  }

  /**
   * Creates a new project
   * @param payload
   */
  async createProject(payload: { name: string }) {
    return this.#client.post<{ id: string; name: string }>("/api/projects/create", {
      body: payload,
    });
  }

  /**
   * Deletes a project
   * @param payload
   */
  async deleteProject(payload: { name: string }) {
    return this.#client.post<{ id: string; name: string }>("/api/projects/delete", {
      body: payload,
    });
  }

  /**
   * Appends history data point for a specific branch or create a new branch in case it doesn't exist
   * @param payload
   */
  async appendHistory(payload: { history: HistoryDataPoint; branch?: string }) {
    if (!this.project) {
      throw new Error("Project is not set");
    }

    return this.#client.post("/api/history/append", {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        ...payload,
        project: this.project,
      },
    });
  }

  /**
   * Downloads history data for a specific branch
   * @param payload
   */
  async downloadHistory(payload?: { branch?: string }) {
    if (!this.project) {
      throw new Error("Project is not set");
    }

    return this.#client.get<HistoryDataPoint[]>("/api/history/download", {
      params: {
        project: this.project,
        ...payload,
      },
    });
  }

  /**
   * Creates a new report and returns the URL
   * @param payload
   */
  async createReport(payload: { reportName: string; reportUuid?: string }) {
    const { reportName, reportUuid } = payload;

    if (!this.project) {
      throw new Error("Project is not set");
    }

    return this.#client.post<{ url: string }>("/api/reports/create", {
      body: {
        project: this.project,
        name: reportName,
        id: reportUuid,
      },
    });
  }

  /**
   * Adds a file to an existing report
   * If the report doesn't exist, it will be created
   * @param payload
   */
  async addReportFile(payload: { reportUuid: string; key: string; file?: Buffer; filepath?: string }) {
    const { reportUuid, key, file, filepath } = payload;

    if (!file && !filepath) {
      throw new Error("File or filepath is required");
    }

    let content = file;

    if (!content) {
      content = await readFile(filepath!);
    }

    const form = new FormData();

    form.set("report", reportUuid);
    form.set("filename", key);
    form.set("file", content);

    await this.#client.post("/api/reports/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return joinPosix(this.#url, reportUuid, key);
  }
}
