import type { AllureHistory } from "@allurereport/core-api";
import type { AllureServiceClient } from "./service.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(
    readonly params: {
      allureServiceClient: AllureServiceClient;
      branch?: string;
      limit?: number;
    },
  ) {}

  async readHistory() {
    const { allureServiceClient, branch, limit } = this.params;

    if (!branch) {
      return [];
    }

    try {
      const res = await allureServiceClient.downloadHistory({
        branch,
        limit,
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
