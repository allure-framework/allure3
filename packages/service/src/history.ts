import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";
import type { AllureServiceClient } from "./service.js";
import { KnownError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(readonly allureServiceClient: AllureServiceClient) {}

  async readHistory(branch?: string) {
    try {
      const res = await this.allureServiceClient.downloadHistory({
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

  async appendHistory(data: HistoryDataPoint, branch?: string) {
    await this.allureServiceClient.appendHistory({
      history: data,
      branch,
    });
  }
}
