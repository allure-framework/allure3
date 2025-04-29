import { type HistoryDataPoint } from "@allurereport/core-api";
import { type Config } from "@allurereport/plugin-api";
import open from "open";
import { DEFAULT_HISTORY_SERVICE_URL } from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";
import { decryptExchangeToken, deleteAccessToken, writeAccessToken, writeExchangeToken } from "./utils/token.js";

export class AllureService {
  readonly #client: HttpClient;
  readonly #url: string;
  project: string | undefined;

  constructor(readonly config: Config["allureService"]) {
    this.#url = config?.url ?? DEFAULT_HISTORY_SERVICE_URL;
    this.#client = createServiceHttpClient(this.#url, config?.accessToken);
    this.project = config?.project;
  }

  setProject(project: string) {
    this.project = project;
  }

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
          const { data } = await this.#client.post(
            "/api/auth/tokens/exchange",
            {
              token,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (!data.accessToken) {
            globalThis.clearTimeout(currentExchangeAttemptTimeout);
            currentExchangeAttemptTimeout = makeExchangeAttempt();
            return;
          }

          await writeAccessToken(data.accessToken);

          return res(data.accessToken);
        }, 2500);
      };

      currentExchangeAttemptTimeout = makeExchangeAttempt();
    });
  }

  async logout() {
    await deleteAccessToken();
  }

  async profile() {
    const { data } = await this.#client.get("/api/user/profile");

    return data as { email: string };
  }

  async projects() {
    const { data } = await this.#client.get("/api/projects/list");

    return data as { id: string; name: string }[];
  }

  async createProject(payload: { name: string }) {
    const { data } = await this.#client.post("/api/projects/create", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return data as { id: string; name: string };
  }

  async deleteProject(payload: { name: string }) {
    const { data } = await this.#client.post("/api/projects/delete", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return data;
  }

  /**
   * Appends history data point for a specific branch or create a new branch in case it doesn't exist
   * @param payload
   */
  async appendHistory(payload: { history: HistoryDataPoint; branch?: string }) {
    if (!this.project) {
      throw new Error("Project is not set");
    }

    await this.#client.post(
      "/api/history/append",
      {
        ...payload,
        project: this.project,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  /**
   * Downloads history data for a specific branch
   * @param payload
   */
  async downloadHistory(payload: { branch?: string }): Promise<HistoryDataPoint[]> {
    if (!this.project) {
      throw new Error("Project is not set");
    }

    const { data } = await this.#client.get(
      "/api/history/download",
      {
        ...payload,
        project: this.project,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return data as HistoryDataPoint[];
  }
}
