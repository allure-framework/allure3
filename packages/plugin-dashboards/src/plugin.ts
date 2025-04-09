import { getWorstStatus } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext, PluginSummary } from "@allurereport/plugin-api";
import { generateAllCharts, generateStaticFiles } from "./generators.js";
import type { DashboardsPluginOptions } from "./model.js";
import { type DashboardsDataWriter, InMemoryDashboardsDataWriter, ReportFileDashboardsDataWriter } from "./writer.js";

export class DashboardsPlugin implements Plugin {
  #writer: DashboardsDataWriter | undefined;

  constructor(readonly options: DashboardsPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    await generateAllCharts(this.#writer!, store, this.options, context);

    const reportDataFiles = this.options.singleFile
      ? (this.#writer! as InMemoryDashboardsDataWriter).reportFiles()
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
      this.#writer = new InMemoryDashboardsDataWriter();
    } else {
      this.#writer = new ReportFileDashboardsDataWriter(context.reportFiles);
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
