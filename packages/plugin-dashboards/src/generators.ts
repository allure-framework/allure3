import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { AvailableTrendChartData } from "./types.js";
import { getSeverityTrendData } from "./charts/severityTrend.js";
import { getStatusTrendData } from "./charts/statusTrend.js";

import type { ChartType, DashboardsPluginOptions } from "./model.js";

export const generateCharts = async (options: DashboardsPluginOptions, store: AllureStore, context: PluginContext): Promise<Record<ChartType, AvailableTrendChartData> | undefined> => {
  const { layout } = options;

  if (!layout) {
    return undefined;
  }

  const historyDataPoints = await store.allHistoryDataPoints();
    const statistic = await store.testsStatistic();
    const testResults = await store.allTestResults();

    return layout?.reduce((acc, chart) => {
      const { type } = chart;

      switch (type) {
        case "status":
          acc[type] = getStatusTrendData(statistic, context.reportName, historyDataPoints);
          break;
        case "severity":
          acc[type] = getSeverityTrendData(testResults, context.reportName, historyDataPoints);
          break;
        default:
          break;
      }

      return acc;
    }, {} as Record<ChartType, AvailableTrendChartData>);
};
