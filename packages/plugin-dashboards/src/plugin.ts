import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import { getSeverityTrendData } from "./charts/severity-trend.js";
import { getStatusTrendData } from "./charts/status-trend.js";
import type { ChartsPluginOptions } from "./model.js";
import { type ChartsDataWriter, InMemoryChartsDataWriter, ReportFileChartsDataWriter } from "./writer.js";

export class ChartsPlugin implements Plugin {
  #writer: ChartsDataWriter | undefined;

  constructor(readonly options: ChartsPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const statistic = await store.testsStatistic();
    const historyDataPoints = await store.allHistoryDataPoints();
    const testResults = await store.allTestResults();

    // Trend data generation
    const statusTrendData = getStatusTrendData(statistic, context.reportName, historyDataPoints);
    const severityTrendData = getSeverityTrendData(testResults, context.reportName, historyDataPoints);

    await this.#writer!.writeWidget("history-trend.json", {
      charts: {
        status: statusTrendData,
        severity: severityTrendData,
      },
    });
  };

  start = async (context: PluginContext) => {
    const { singleFile } = this.options;

    if (singleFile) {
      this.#writer = new InMemoryChartsDataWriter();
      return;
    }

    this.#writer = new ReportFileChartsDataWriter(context.reportFiles);

    await Promise.resolve();
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
