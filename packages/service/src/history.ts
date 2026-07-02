import { type AllureHistory, type HistoryDataPoint, normalizeHistoryDataPointUrls } from "@allurereport/core-api";

import type { AllureServiceApiClient } from "./model.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  /**
   * Cache of history data points
   * cache key is a combination of options for readHistory method
   */
  #cache = new Map<string, HistoryDataPoint[]>();

  constructor(
    readonly params: {
      allureServiceClient: AllureServiceApiClient;
      limit?: number;
      repo?: string;
      branch?: string;
    },
  ) {}

  #cacheKey(params: { repo?: string; branch?: string; limit?: number }) {
    const { repo, branch, limit } = params ?? {};
    return `${repo ?? ""}-${branch ?? ""}-${limit ?? 9000}` as const;
  }

  async readHistory(params?: { repo?: string; branch?: string; limit?: number; force?: boolean }) {
    const {
      limit = this.params.limit,
      repo = this.params.repo,
      branch = this.params.branch,
      force = false,
    } = params ?? {};

    if (!force && this.#cache.has(this.#cacheKey({ repo, branch, limit }))) {
      return this.#cache.get(this.#cacheKey({ repo, branch, limit }))!;
    }

    try {
      const res = await this.params.allureServiceClient.downloadHistory({
        repo: repo || undefined,
        branch: branch || undefined,
        limit,
      });

      const normalizedHistory = res.map(normalizeHistoryDataPointUrls);

      this.#cache.set(this.#cacheKey({ repo, branch, limit }), normalizedHistory);

      return normalizedHistory;
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
