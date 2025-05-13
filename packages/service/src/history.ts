import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import { AllureService } from "./service.js";

export class AllureRemoteHistory implements AllureHistory {
  readonly #service: AllureService;

  constructor(allureServiceConfig: Config["allureService"]) {
    this.#service = new AllureService(allureServiceConfig);
  }

  async readHistory(branch?: string) {
    return await this.#service.downloadHistory({
      branch,
    });
  }

  async appendHistory(data: HistoryDataPoint, branch?: string) {
    await this.#service.appendHistory({
      history: data,
      branch,
    });
  }
}
