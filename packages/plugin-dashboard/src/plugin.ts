import { getWorstStatus } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext, PluginSummary } from "@allurereport/plugin-api";
import { generateAllCharts, generateStaticFiles } from "./generators.js";
import type { DashboardPluginOptions } from "./model.js";
import { type DashboardDataWriter, InMemoryDashboardDataWriter, ReportFileDashboardDataWriter } from "./writer.js";

export class DashboardPlugin implements Plugin {
  #writer: DashboardDataWriter | undefined;

  constructor(readonly options: DashboardPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    await generateAllCharts(this.#writer!, store, this.options, context);

    const reportDataFiles = this.options.singleFile
      ? (this.#writer! as InMemoryDashboardDataWriter).reportFiles()
      : [];

    await generateStaticFiles({
      ...this.options,
      allureVersion: context.allureVersion,
      reportFiles: context.reportFiles,
      reportDataFiles,
      reportUuid: context.reportUuid,
      reportName: context.reportName,
    });
  };

  start = async (context: PluginContext): Promise<void> => {
    if (this.options.singleFile) {
      this.#writer = new InMemoryDashboardDataWriter();
    } else {
      this.#writer = new ReportFileDashboardDataWriter(context.reportFiles);
    }
  };

  update = async (context: PluginContext, store: AllureStore) => {
    if (!this.#writer) {
      throw new Error("call start first");
    }

    await this.#generate(context, store);
  };

  done = async (context: PluginContext, store: AllureStore) => {
    if (!this.#writer) {
      throw new Error("call start first");
    }

    await this.#generate(context, store);
  };

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary> {
    const allTrs = (await store.allTestResults()).filter(this.options.filter ? this.options.filter : () => true);
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    return {
      name: this.options.reportName || context.reportName,
      stats: await store.testsStatistic(this.options.filter),
      status: worstStatus ?? "passed",
      duration,
    };
  }
}
