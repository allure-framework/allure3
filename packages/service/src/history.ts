import type { AllureHistory } from "@allurereport/core-api";
import type { AllureServiceClient } from "./service.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(readonly params: { allureServiceClient: AllureServiceClient; limit?: number; branch?: string }) {}

  /**
   * @param params
   * @param params.branch - branch to read history from, pass to override default branch given in the constructor
   * @param params.limit - limit of history points to read, pass to override default limit given in the constructor
   */
  async readHistory(params?: { branch?: string; limit?: number }) {
    const { branch = this.params.branch, limit = this.params.limit } = params ?? {};

    try {
      const res = await this.params.allureServiceClient.downloadHistory({
        limit,
        branch,
      });

      return res;
    } catch (err) {
      if (err instanceof KnownError && err.status === 404) {
        return [];
      }

      throw err;
    }
  }

  async appendHistory() {
    // keep the method empty because we upload new remote history points when creating remote report
  }
}
