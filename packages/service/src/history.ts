import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";
import type { AllureService } from "./service.js";
import { NotFoundError } from "./utils/http.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(readonly allureService: AllureService) {}

  async readHistory(branch?: string) {
    try {
      const res = await this.allureService.downloadHistory({
        branch,
      });

      return res;
    } catch (err) {
      if (err instanceof NotFoundError) {
        return [];
      }

      throw err;
    }
  }

  async appendHistory(data: HistoryDataPoint, branch?: string) {
    await this.allureService.appendHistory({
      history: data,
      branch,
    });
  }
}
