import type { AllureHistory, HistoryDataPoint, RepoData } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import { AllureService } from "./service.js";

export class AllureRemoteHistory implements AllureHistory {
  readonly #service: AllureService;

  constructor(
    allureServiceConfig: Config["allureService"],
    private readonly repoDataAccessor: () => Promise<RepoData | undefined>,
  ) {
    this.#service = new AllureService(allureServiceConfig);
  }

  async readHistory() {
    const repoData = await this.repoDataAccessor();

    return await this.#service.downloadHistory({
      branch: repoData?.branch,
    });
  }

  async appendHistory(data: HistoryDataPoint) {
    const repoData = await this.repoDataAccessor();

    await this.#service.appendHistory({
      history: data,
      branch: repoData?.branch,
    });
  }
}
