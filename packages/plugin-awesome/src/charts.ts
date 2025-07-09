import type { HistoryDataPoint, SeverityLevel, Statistic, TestResult, TestStatus } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import {
  ChartDataType,
  ChartMode,
  ChartType,
  DEFAULT_CHART_HISTORY_LIMIT,
  getPieChartDataDashboard,
  getSeverityTrendData,
  getStatusTrendData,
} from "@allurereport/web-commons";
import { randomUUID } from "crypto";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export type BasePieSlice = Pick<PieSlice, "status" | "count">;

export const d3Arc = arc<PieArcDatum<BasePieSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<BasePieSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export type ChartId = string;

export type ExecutionIdFn = (executionOrder: number) => string;
export type ExecutionNameFn = (executionOrder: number) => string;

export type TrendMetadataFnOverrides = {
  executionIdAccessor?: ExecutionIdFn;
  executionNameAccessor?: ExecutionNameFn;
};

export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

// Type aliases for meaningful string keys
export type TrendPointId = string;
export type TrendSliceId = string;

// Base type for metadata
export type BaseMetadata = Record<string, unknown>;

export interface BaseTrendSliceMetadata extends Record<string, unknown> {
  executionId: string;
  executionName: string;
}

export type TrendSliceMetadata<Metadata extends BaseMetadata> = BaseTrendSliceMetadata & Metadata;

export type TrendPoint = {
  x: string;
  y: number;
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
export type StatusTrendChartData = GenericTrendChartData<StatusTrendSliceMetadata, TestStatus>;

export interface SeverityMetadata extends BaseTrendSliceMetadata {}

export type SeverityTrendSliceMetadata = TrendSliceMetadata<SeverityMetadata>;
export type SeverityTrendSlice = TrendSlice<SeverityTrendSliceMetadata>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityTrendSliceMetadata, SeverityLevel>;

export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

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

export type DashboardOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
  filter?: (testResult: TestResult) => boolean;
};

// Common type for trend data operations
export type TrendDataType = TestStatus | SeverityLevel;

// Type for calculation result
export type TrendCalculationResult<T extends TrendDataType> = {
  points: Record<TrendPointId, TrendPoint>;
  series: Record<T, TrendPointId[]>;
};

/**
 * Initializes stats record with items as keys and 0 as values.
 * @param items - Items for stats record.
 * @returns Record with items as keys and 0 values.
 */
export const createEmptyStats = <T extends TrendDataType>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

/**
 * Initializes series record with items as keys and empty arrays.
 * @param items - Items for series record.
 * @returns Record with items as keys and empty arrays.
 */
export const createEmptySeries = <T extends TrendDataType>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

/**
 * Normalizes stats record, ensuring all items are represented.
 * @param statistic - Partial stats record.
 * @param itemType - All possible items.
 * @returns Complete stats record with all items.
 */
export const normalizeStatistic = <T extends TrendDataType>(
  statistic: Partial<Record<T, number>>,
  itemType: readonly T[],
): Record<T, number> => {
  return itemType.reduce(
    (acc, item) => {
      acc[item] = statistic[item] ?? 0;
      return acc;
    },
    {} as Record<T, number>,
  );
};

/**
 * Calculates raw trend data points and series.
 * @param stats - Statistical values for items.
 * @param executionId - Execution context identifier.
 * @param itemType - Items for trend data.
 * @returns Points and series for visualization.
 */
const calculateRawValues = <T extends TrendDataType>(
  stats: Record<T, number>,
  executionId: string,
  itemType: readonly T[],
): TrendCalculationResult<T> => {
  const points: Record<TrendPointId, TrendPoint> = {};
  const series = createEmptySeries(itemType);

  itemType.forEach((item) => {
    const pointId = `${executionId}-${item}`;
    const value = stats[item] ?? 0;

    points[pointId] = {
      x: executionId,
      y: value,
    };

    series[item].push(pointId);
  });

  return { points, series };
};

/**
 * Calculates percentage trend data points and series.
 * @param stats - Statistical values for items.
 * @param executionId - Execution context identifier.
 * @param itemType - Items for trend data.
 * @returns Points and series for visualization.
 */
const calculatePercentValues = <T extends TrendDataType>(
  stats: Record<T, number>,
  executionId: string,
  itemType: readonly T[],
): TrendCalculationResult<T> => {
  const points: Record<TrendPointId, TrendPoint> = {};
  const series = createEmptySeries(itemType);
  const values = Object.values<number>(stats);
  const total = values.reduce<number>((sum, value) => sum + value, 0);

  if (total === 0) {
    return { points, series };
  }

  itemType.forEach((item) => {
    const pointId = `${executionId}-${item}`;
    const value = stats[item] ?? 0;

    points[pointId] = {
      x: executionId,
      y: value / total,
    };

    series[item].push(pointId);
  });

  return { points, series };
};

/**
 * Merges two trend data sets into one.
 * @param trendData - Primary trend data.
 * @param trendDataPart - Secondary trend data.
 * @param itemType - Items for data inclusion.
 * @returns Merged dataset for analysis.
 */
export const mergeTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  trendData: GenericTrendChartData<M, T>,
  trendDataPart: GenericTrendChartData<M, T>,
  itemType: readonly T[],
): GenericTrendChartData<M, T> => {
  return {
    ...trendData,
    points: {
      ...trendData.points,
      ...trendDataPart.points,
    },
    slices: {
      ...trendData.slices,
      ...trendDataPart.slices,
    },
    series: Object.entries(trendDataPart.series).reduce(
      (series, [group, pointIds]) => {
        if (Array.isArray(pointIds)) {
          return {
            ...series,
            [group]: [...(trendData.series?.[group as T] || []), ...pointIds],
          };
        }

        return series;
      },
      trendData.series || createEmptySeries(itemType),
    ),
    min: Math.min(trendData.min ?? Infinity, trendDataPart.min),
    max: Math.max(trendData.max ?? -Infinity, trendDataPart.max),
  };
};

/**
 * Generates trend data from stats and options.
 * @param stats - Statistical values for items.
 * @param reportName - Associated report name.
 * @param executionOrder - Execution sequence order.
 * @param itemType - Items for trend data.
 * @param chartOptions - Chart configuration options.
 * @returns Dataset for trend visualization.
 */
export const getTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  stats: Record<T, number>,
  reportName: string,
  executionOrder: number,
  itemType: readonly T[],
  chartOptions: TrendChartOptions,
): GenericTrendChartData<M, T> => {
  const { type, dataType, title, mode = ChartMode.Raw, metadata = {} } = chartOptions;
  const { executionIdAccessor, executionNameAccessor } = metadata;
  const executionId = executionIdAccessor ? executionIdAccessor(executionOrder) : `execution-${executionOrder}`;

  const { points, series } =
    mode === ChartMode.Percent
      ? calculatePercentValues(stats, executionId, itemType)
      : calculateRawValues(stats, executionId, itemType);

  const slices: Record<string, { min: number; max: number; metadata: M }> = {};

  // Create slice
  const pointsAsArray = Object.values(points);
  const pointsCount = pointsAsArray.length;
  const values = pointsAsArray.map((point) => point.y);
  const min = pointsCount ? Math.min(...values) : 0;
  const max = pointsCount ? Math.max(...values) : 0;

  // Omit creating slice if there are no points in it
  if (pointsCount > 0) {
    const executionName = executionNameAccessor ? executionNameAccessor(executionOrder) : reportName;

    slices[executionId] = {
      min,
      max,
      metadata: {
        executionId,
        executionName,
      } as M,
    };
  }

  return {
    type,
    dataType,
    mode,
    title,
    points,
    slices,
    series,
    min,
    max,
  };
};

const generatePieChart = (
  options: PieChartOptions,
  stores: {
    statistic: Statistic;
  },
): PieChartData => {
  const { statistic } = stores;

  return getPieChartDataDashboard(statistic, options);
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
