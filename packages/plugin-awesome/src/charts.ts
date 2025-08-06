import {
  ChartDataType,
  ChartType,
  type TrendChartData,
  type HistoryDataPoint,
  type Statistic,
  type TestResult,
  type TrendSliceMetadata,
  type BaseTrendSliceMetadata,
  type TrendSlice,
  type PieChartData,
  type GeneratedChartData,
  type GeneratedChartsData,
  type TrendChartOptions,
  type PieChartOptions,
} from "@allurereport/core-api";
import { type AllureStore, type PluginContext, DEFAULT_CHART_HISTORY_LIMIT, getSeverityTrendData, getStatusTrendData } from "@allurereport/plugin-api";
import { getPieChartData } from "@allurereport/web-commons";
import { randomUUID } from "crypto";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export interface StatusMetadata extends BaseTrendSliceMetadata {}

export type StatusTrendSliceMetadata = TrendSliceMetadata<StatusMetadata>;
export type StatusTrendSlice = TrendSlice<StatusTrendSliceMetadata>;

const generatePieChart = (
  options: PieChartOptions,
  stores: {
    statistic: Statistic;
  },
): PieChartData => {
  const { statistic } = stores;

  return getPieChartData(statistic, options);
};

export const generateCharts = async (
  options: AwesomeOptions,
  store: AllureStore,
  context: PluginContext,
): Promise<GeneratedChartsData | undefined> => {
  const { charts } = options;

  if (!charts) {
    return undefined;
  }

  const historyDataPoints = await store.allHistoryDataPoints();
  const statistic = await store.testsStatistic();
  const testResults = await store.allTestResults();

  return charts.reduce((acc, chartOptions) => {
    const chartId = randomUUID();

    let chart: GeneratedChartData | undefined;

    if (chartOptions.type === ChartType.Trend) {
      chart = generateTrendChart(
        chartOptions,
        {
          historyDataPoints,
          statistic,
          testResults,
        },
        context,
      );
    } else if (chartOptions.type === ChartType.Pie) {
      chart = generatePieChart(chartOptions, { statistic });
    }

    if (chart) {
      acc[chartId] = chart;
    }

    return acc;
  }, {} as GeneratedChartsData);
};

export const generateTrendChart = (
  options: TrendChartOptions,
  stores: {
    historyDataPoints: HistoryDataPoint[];
    statistic: Statistic;
    testResults: TestResult[];
  },
  context: PluginContext,
): TrendChartData | undefined => {
  const newOptions = { limit: DEFAULT_CHART_HISTORY_LIMIT, ...options };
  const { dataType } = newOptions;
  const { statistic, historyDataPoints, testResults } = stores;

  if (dataType === ChartDataType.Status) {
    return getStatusTrendData(statistic, context.reportName, historyDataPoints, newOptions);
  } else if (dataType === ChartDataType.Severity) {
    return getSeverityTrendData(testResults, context.reportName, historyDataPoints, newOptions);
  }
};

export const generateAllCharts = async (
  writer: AwesomeDataWriter,
  store: AllureStore,
  options: AwesomeOptions,
  context: PluginContext,
): Promise<void> => {
  const charts = await generateCharts(options, store, context);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("charts.json", charts);
  }
};
