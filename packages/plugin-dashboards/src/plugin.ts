import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import { getSeverityTrendData } from "./charts/severity-trend.js";
import { getStatusTrendData } from "./charts/status-trend.js";
import type { DashboardsPluginOptions } from "./model.js";
import { type DashboardsDataWriter, InMemoryDashboardsDataWriter, ReportFileDashboardsDataWriter } from "./writer.js";

export class DashboardsPlugin implements Plugin {
  #writer: DashboardsDataWriter | undefined;

  constructor(readonly options: DashboardsPluginOptions = {}) {}

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
