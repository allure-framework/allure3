import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { GeneratedChartsData } from "./types.js";
import { getSeverityTrendData } from "./charts/severityTrend.js";
import { getStatusTrendData } from "./charts/statusTrend.js";

import type { DashboardsPluginOptions } from "./model.js";
import { ChartType } from "./model.js";
import { randomUUID } from "crypto";

export const generateCharts = async (options: DashboardsPluginOptions, store: AllureStore, context: PluginContext) => {
  const { layout } = options;

  if (!layout) {
    return undefined;
  }

  const historyDataPoints = await store.allHistoryDataPoints();
  const statistic = await store.testsStatistic();
  const testResults = await store.allTestResults();

  return layout?.reduce((acc, chartOptions) => {
    const { type } = chartOptions;

    const chartId = randomUUID();

    switch (type) {
      case ChartType.STATUS:
        acc[chartId] = getStatusTrendData(statistic, context.reportName, historyDataPoints, chartOptions);
        break;
      case ChartType.SEVERITY:
        acc[chartId] = getSeverityTrendData(testResults, context.reportName, historyDataPoints, chartOptions);
        break;
      default:
        break;
    }

    return acc;
  }, {} as GeneratedChartsData);
};
