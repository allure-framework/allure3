import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";
import type { AllureService } from "./service.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(readonly allureService: AllureService) {}

  async readHistory(branch?: string) {
    return await this.allureService.downloadHistory({
      branch,
    });
  }

  async appendHistory(data: HistoryDataPoint, branch?: string) {
    await this.allureService.appendHistory({
      history: data,
      branch,
    });
  }
}
