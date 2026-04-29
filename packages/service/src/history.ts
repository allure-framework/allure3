import { type AllureHistory, normalizeHistoryDataPointUrls } from "@allurereport/core-api";

import type { AllureServiceClient } from "./service.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(
    readonly params: {
      allureServiceClient: AllureServiceClient;
      limit?: number;
      repo?: string;
      branch?: string;
    },
  ) {}

  async readHistory(params?: { repo?: string; branch?: string }) {
    const { limit } = this.params;

    try {
      const res = await this.params.allureServiceClient.downloadHistory({
        repo: params?.repo || this.params.repo || undefined,
        branch: params?.branch || this.params.branch || undefined,
        limit,
      });

      return res?.map(normalizeHistoryDataPointUrls);
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
