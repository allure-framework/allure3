import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import type { DashboardsPluginOptions } from "./model.js";
import { type DashboardsDataWriter, InMemoryDashboardsDataWriter, ReportFileDashboardsDataWriter } from "./writer.js";
import { generateCharts } from "./generators.js";

export class DashboardsPlugin implements Plugin {
  #writer: DashboardsDataWriter | undefined;

  constructor(readonly options: DashboardsPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const charts = await generateCharts(this.options, store, context);

    if (charts && Object.keys(charts).length > 0) {
      await this.#writer!.writeWidget("history-trend.json", { charts });
    }
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
}
