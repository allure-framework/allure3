import open from "open";
import { DEFAULT_HISTORY_SERVICE_URL } from "./model.js";
import { type HttpClient, createServiceHttpClient } from "./utils/http.js";
import { decryptExchangeToken, writeAccessToken, writeExchangeToken } from "./utils/token.js";

export class AllureHistoryService {
  #client: HttpClient;

  constructor(readonly historyServiceURL: string = DEFAULT_HISTORY_SERVICE_URL) {
    this.#client = createServiceHttpClient(historyServiceURL);
  }

  async login(): Promise<string> {
    const exchangeToken = await writeExchangeToken();
    const connectUrl = new URL("/connect", this.historyServiceURL);

    connectUrl.searchParams.set("token", decryptExchangeToken(exchangeToken));

    await open(connectUrl.toString());

    let currentExchangeAttemptTimeout: NodeJS.Timeout | undefined;

    return await new Promise((res) => {
      const makeExchangeAttempt = (): NodeJS.Timeout => {
        return globalThis.setTimeout(async () => {
          const token = decryptExchangeToken(exchangeToken);
          const { data } = await this.#client.post(
            "/api/auth/exchange",
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

  async profile() {
    const { data } = await this.#client.get("/api/user/profile");

    // TODO: introduce types
    return data as { email: string };
  }

  async projects() {
    const { data } = await this.#client.get("/api/projects/list");

    // TODO: introduce types
    return data as { id: string; name: string }[];
  }

  async createProject(payload: { name: string }) {
    const { data } = await this.#client.post("/api/projects/create", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // TODO: introduce types
    return data as { id: string; name: string };
  }

  async deleteProject(payload: { id: string }) {
    const { data } = await this.#client.post("/api/projects/delete", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return data;
  }
}
