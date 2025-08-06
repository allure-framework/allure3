import {
  ChartDataType,
  ChartMode,
  ChartType,
  ChartId,
  TrendChartData,
  type HistoryDataPoint,
  type Statistic,
  type TestResult,
  type TestStatus,
  type TrendSliceMetadata,
  TrendPointId,
  TrendSliceId,
  BaseMetadata,
  BaseTrendSliceMetadata,
  TrendPoint,
} from "@allurereport/core-api";
import { type AllureStore, type PluginContext, type TrendMetadataFnOverrides, DEFAULT_CHART_HISTORY_LIMIT, getSeverityTrendData, getStatusTrendData } from "@allurereport/plugin-api";
import { getPieChartData } from "@allurereport/web-commons";
import { randomUUID } from "crypto";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

export type TrendSlice<Metadata extends BaseMetadata> = {
  // Minimum value on Y-axis of the trend chart slice
  min: number;
  // Maximum value on Y-axis of the trend chart slice
  max: number;
  // Metadata about this test execution
  metadata: TrendSliceMetadata<Metadata>;
};

export type GenericTrendChartData<Metadata extends BaseMetadata, SeriesType extends string> = {
  // Type of the chart
  type: ChartType.Trend;
  // Data type of the chart
  dataType: ChartDataType;
  // Chart mode to know type of values on Y-axis
  mode: ChartMode;
  // Title of the chart
  title?: string;
  // Points for all series
  points: Record<TrendPointId, TrendPoint>;
  // Slices for all series
  slices: Record<TrendSliceId, TrendSlice<Metadata>>;
  // Grouping by series, containing array of point IDs for each status
  series: Record<SeriesType, TrendPointId[]>;
  // Minimum value on Y-axis of the trend chart
  min: number;
  // Maximum value on Y-axis of the trend chart
  max: number;
};

export interface StatusMetadata extends BaseTrendSliceMetadata {}

export type StatusTrendSliceMetadata = TrendSliceMetadata<StatusMetadata>;
export type StatusTrendSlice = TrendSlice<StatusTrendSliceMetadata>;

export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type PieSlice = {
  status: TestStatus;
  count: number;
  d: string | null;
};

export type PieChartData = {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
};

export type GeneratedChartData = TrendChartData | PieChartData;

export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

export type ChartOptions = TrendChartOptions | PieChartOptions;

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
