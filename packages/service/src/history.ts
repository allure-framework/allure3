import { type AllureHistory, normalizeHistoryDataPointUrls } from "@allurereport/core-api";

import type { AllureServiceApiClient } from "./model.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(
    readonly params: {
      allureServiceClient: AllureServiceApiClient;
      limit?: number;
      repo?: string;
      branch?: string;
    },
  ) {}

  resolveTestResultUrl(historyUrl: string, pluginId: string, historicalResultId: string): string {
    if (!historyUrl) {
      return "";
    }

    const { origin, pathname } = new URL(historyUrl);
    // Service history does not perform folder flattening, always add pluginId to the constructed url
    const navigateUrl = new URL([pathname, pluginId].join("/"), origin);
    navigateUrl.hash = historicalResultId;

    return navigateUrl.toString();
  }

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
