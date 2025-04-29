import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";
import type { AllureService } from "./service.js";

export class AllureRemoteHistory implements AllureHistory {
  constructor(
    private readonly service: AllureService,
    private readonly store: AllureStore,
  ) {}

  async readHistory() {
    const repoData = await this.store.repoData();

    return await this.service.downloadHistory({
      branch: repoData?.branch,
    });
  }

  async appendHistory(data: HistoryDataPoint) {
    const repoData = await this.store.repoData();

    await this.service.appendHistory({
      history: data,
      branch: repoData?.branch,
    });
  }
}
