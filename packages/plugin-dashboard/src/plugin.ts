import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  convertToSummaryTestResult,
} from "@allurereport/plugin-api";
import { generateAllCharts, generateEnvirontmentsList, generateStaticFiles } from "./generators.js";
import type { DashboardPluginOptions } from "./model.js";
import { type DashboardDataWriter, InMemoryDashboardDataWriter, ReportFileDashboardDataWriter } from "./writer.js";

export class DashboardPlugin implements Plugin {
  #writer: DashboardDataWriter | undefined;

  constructor(readonly options: DashboardPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    await generateAllCharts(this.#writer!, store, this.options, context, this.options.filter);
    await generateEnvirontmentsList(this.#writer!, store);

    const reportDataFiles = this.options.singleFile ? (this.#writer! as InMemoryDashboardDataWriter).reportFiles() : [];

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
    const allTrs = await store.allTestResults({ filter: this.options.filter });
    const newTrs = await store.allNewTestResults(this.options.filter);

    const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
    const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
    const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

    return {
      name: this.options.reportName || context.reportName,
      stats: await store.testsStatistic(this.options.filter),
      status: worstStatus ?? "passed",
      duration,
      createdAt,
      plugin: "Dashboard",
      newTests: newTrs.map(convertToSummaryTestResult),
      flakyTests: flakyTrs.map(convertToSummaryTestResult),
      retryTests: retryTrs.map(convertToSummaryTestResult),
      meta: {
        reportId: context.reportUuid,
        singleFile: this.options.singleFile ?? false,
      },
    };
  }
}
