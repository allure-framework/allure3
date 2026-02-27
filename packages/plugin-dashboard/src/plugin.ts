import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
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
    return createPluginSummary({
      name: this.options.reportName || context.reportName,
      plugin: "Dashboard",
      meta: {
        reportId: context.reportUuid,
        singleFile: this.options.singleFile ?? false,
      },
      filter: this.options.filter,
      history: context.history,
      ci: context.ci,
      store,
    });
  }
}
