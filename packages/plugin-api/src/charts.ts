import type {
  BarGroup,
  BarGroupMode,
  BarGroupValues,
  BaseTrendSliceMetadata,
  ChartId,
  HistoryDataPoint,
  PieSlice,
  SeverityLevel,
  Statistic,
  TestResult,
  TestStatus,
  TrendPoint,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
} from "@allurereport/core-api";
import { BarChartType, ChartDataType, ChartMode, ChartType, getPieChartValues } from "@allurereport/core-api";
import type { PluginContext } from "./plugin.js";
import { severityTrendDataAccessor } from "./severityTrendAccessor.js";
import { statusBySeverityBarDataAccessor } from "./statusBySeverityBarAccessor.js";
import { statusChangeTrendBarAccessor } from "./statusChangeTrendBarAccessor.js";
import { statusTrendDataAccessor } from "./statusTrendAccessor.js";
import { statusTrendBarAccessor } from "./statusTrendBarAccessor.js";

export type ExecutionIdFn = (executionOrder: number) => string;
export type ExecutionNameFn = (executionOrder: number) => string;

export type TrendMetadataFnOverrides = {
  executionIdAccessor?: ExecutionIdFn;
  executionNameAccessor?: ExecutionNameFn;
};

// Common type for trend data operations
export type TrendDataType = TestStatus | SeverityLevel;

// Type for calculation result
export type TrendCalculationResult<T extends TrendDataType> = {
  points: Record<TrendPointId, TrendPoint>;
  series: Record<T, TrendPointId[]>;
};

// Generic structure for trend chart data
export interface GenericTrendChartData<
  SeriesType extends string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> {
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
}

// Specific trend chart data types
export type StatusTrendChartData = GenericTrendChartData<TestStatus>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityLevel>;

export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

// Bar chart data types
export interface BarChartData {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode: ChartMode;
  title?: string;
  data: BarGroup<string, string>[];
  keys: readonly string[];
  indexBy: string;
  groupMode: BarGroupMode;
}

// Union types for generated chart data
export type GeneratedChartData = TrendChartData | PieChartData | BarChartData | ComingSoonChartData;
export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

export type TrendStats<T extends TrendDataType> = Record<T, number>;

// Chart options
export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type BarChartOptions = {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
};

export type ComingSoonChartOptions = {
  type: ChartType.ComingSoon;
  title?: string;
};

export type ChartOptions = TrendChartOptions | PieChartOptions | BarChartOptions | ComingSoonChartOptions;

export interface PieChartData {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
}

export interface ComingSoonChartData {
  type: ChartType.ComingSoon;
  title?: string;
}

export interface AllureChartsStoreData {
  historyDataPoints: HistoryDataPoint[];
  testResults: TestResult[];
  statistic: Statistic;
}

/**
 * @description Limits the history data points by a certain limit, that is necessary for charts data with a long history.
 * @param historyDataPoints - The history data points.
 * @param limit - The limit.
 * @returns The limited history data points.
 */
export const limitHistoryDataPoints = (historyDataPoints: HistoryDataPoint[], limit: number): HistoryDataPoint[] => {
  if (limit <= 0 || historyDataPoints.length === 0) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.floor(limit));

  return historyDataPoints.slice(0, clampedLimit);
};

/**
 * Initializes series record with items as keys and empty arrays.
 * @param items - Items for series record.
 * @returns Record with items as keys and empty arrays.
 */
export const createEmptySeries = <T extends TrendDataType>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

/**
 * Calculates percentage trend data points and series.
 * @param stats - Statistical values for items.
 * @param executionId - Execution context identifier.
 * @param itemType - Items for trend data.
 * @returns Points and series for visualization.
 */
export const calculatePercentValues = <T extends TrendDataType>(
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
 * Generates trend data from stats and options.
 * @param stats - Statistical values for items.
 * @param reportName - Associated report name.
 * @param executionOrder - Execution sequence order.
 * @param itemType - Items for trend data.
 * @param chartOptions - Chart configuration options.
 * @returns Dataset for trend visualization.
 */
export const getTrendDataGeneric = <T extends TrendDataType, M extends BaseTrendSliceMetadata>(
  stats: Record<T, number>,
  reportName: string,
  executionOrder: number,
  itemType: readonly T[],
  chartOptions: TrendChartOptions,
): GenericTrendChartData<T, M> => {
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

/**
 * Initializes stats record with items as keys and 0 as values.
 * @param items - Items for stats record.
 * @returns Record with items as keys and 0 values.
 */
export const createEmptyStats = <T extends string>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

/**
 * Normalizes stats record, ensuring all items are represented.
 * @param statistic - Partial stats record.
 * @param itemType - All possible items.
 * @returns Complete stats record with all items.
 */
export const normalizeStatistic = <T extends string>(
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
 * Merges two trend data sets into one.
 * @param trendData - Primary trend data.
 * @param trendDataPart - Secondary trend data.
 * @param itemType - Items for data inclusion.
 * @returns Merged dataset for analysis.
 */
export const mergeTrendDataGeneric = <T extends TrendDataType, M extends BaseTrendSliceMetadata>(
  trendData: GenericTrendChartData<T, M>,
  trendDataPart: GenericTrendChartData<T, M>,
  itemType: readonly T[],
): GenericTrendChartData<T, M> => {
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

export const DEFAULT_CHART_HISTORY_LIMIT = 10;

export const getPieChartData = (stats: Statistic, chartOptions: PieChartOptions): PieChartData => ({
  type: chartOptions.type,
  title: chartOptions?.title,
  ...getPieChartValues(stats),
});

export const generatePieChart = (
  options: PieChartOptions,
  stores: {
    statistic: Statistic;
  },
): PieChartData => {
  const { statistic } = stores;

  return getPieChartData(statistic, options);
};

export const generateComingSoonChart = (options: ComingSoonChartOptions): ComingSoonChartData => {
  return {
    type: ChartType.ComingSoon,
    title: options.title,
  };
};

export const generateBarChartGeneric = <P extends string, T extends string>(
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
  dataAccessor: BarDataAccessor<P, T>,
): BarChartData | undefined => {
  const { type, dataType, title, limit = DEFAULT_CHART_HISTORY_LIMIT, mode = ChartMode.Raw } = options;

  // Apply limit to history points if specified
  const { historyDataPoints } = storeData;
  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit);
  const isFullHistory = limitedHistoryPoints.length === historyDataPoints.length;

  const items = dataAccessor.getItems(storeData, limitedHistoryPoints, isFullHistory);

  // Apply mode transformation if needed
  let processedData = items;
  if (mode === ChartMode.Percent) {
    processedData = items.map((group) => {
      const { groupId, ...values } = group;

      const total = Object.values<number>(values).reduce((sum, value) => sum + value, 0);
      const nextValues = Object.keys(values).reduce((acc, valueKey) => {
        acc[valueKey as T] = (values as BarGroupValues)[valueKey as T] / total;

        return acc;
      }, {} as BarGroupValues<T>);

      return {
        groupId,
        ...nextValues,
      };
    });
  }

  return {
    type,
    dataType,
    mode,
    title,
    data: processedData,
    keys: dataAccessor.getGroupKeys(),
    groupMode: dataAccessor.getGroupMode(),
    indexBy: "groupId",
  };
};

export interface TrendDataAccessor<T extends TrendDataType> {
  // Get current data for the specified type
  getCurrentData: (storeData: AllureChartsStoreData) => TrendStats<T>;
  // Get data from historical point
  getHistoricalData: (historyPoint: HistoryDataPoint) => TrendStats<T>;
  // List of all possible values for the type
  getAllValues: () => readonly T[];
}

export interface BarDataAccessor<G extends string, T extends string> {
  // Get all needed data for the chart
  getItems: (
    storeData: AllureChartsStoreData,
    limitedHistoryDataPoints: HistoryDataPoint[],
    isFullHistory: boolean,
  ) => BarGroup<G, T>[];
  // List of all possible values for the group
  getGroupKeys: () => readonly T[];
  // Get group mode
  getGroupMode: () => BarGroupMode;
}

export const generateTrendChartGeneric = <T extends TrendDataType>(
  options: TrendChartOptions,
  storeData: AllureChartsStoreData,
  context: PluginContext,
  dataAccessor: TrendDataAccessor<T>,
): GenericTrendChartData<T> | undefined => {
  const { limit } = options;
  const historyLimit = limit && limit > 0 ? Math.max(0, limit - 1) : undefined;

  // Get all required data
  const { historyDataPoints } = storeData;
  const currentData = dataAccessor.getCurrentData(storeData);

  // Apply limit to history points if specified
  const limitedHistoryPoints = historyLimit !== undefined ? historyDataPoints.slice(-historyLimit) : historyDataPoints;

  // Convert history points to statistics
  const firstOriginalIndex = historyLimit !== undefined ? Math.max(0, historyDataPoints.length - historyLimit) : 0;
  const convertedHistoryPoints = limitedHistoryPoints.map((point: HistoryDataPoint, index: number) => {
    const originalIndex = firstOriginalIndex + index;

    return {
      name: point.name,
      originalIndex,
      statistic: dataAccessor.getHistoricalData(point),
    };
  });

  const allValues = dataAccessor.getAllValues();

  // Get current report data
  const currentTrendData = getTrendDataGeneric(
    normalizeStatistic(currentData, allValues),
    context.reportName,
    historyDataPoints.length + 1, // Always use the full history length for current point order
    allValues,
    options,
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduce(
    (
      acc: GenericTrendChartData<T>,
      historyPoint: { name: string; originalIndex: number; statistic: Record<T, number> },
    ) => {
      const trendDataPart = getTrendDataGeneric(
        normalizeStatistic(historyPoint.statistic, allValues),
        historyPoint.name,
        historyPoint.originalIndex + 1,
        allValues,
        options,
      );

      return mergeTrendDataGeneric(acc, trendDataPart, allValues);
    },
    {
      type: options.type,
      dataType: options.dataType,
      mode: options.mode,
      title: options.title,
      points: {},
      slices: {},
      series: createEmptySeries(allValues),
      min: Infinity,
      max: -Infinity,
    } as GenericTrendChartData<T>,
  );

  // Add current report data as the last item
  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, allValues);
};

export const generateTrendChart = (
  options: TrendChartOptions,
  storeData: AllureChartsStoreData,
  context: PluginContext,
): TrendChartData | undefined => {
  const newOptions = { limit: DEFAULT_CHART_HISTORY_LIMIT, ...options };
  const { dataType } = newOptions;

  if (dataType === ChartDataType.Status) {
    return generateTrendChartGeneric(newOptions, storeData, context, statusTrendDataAccessor);
  } else if (dataType === ChartDataType.Severity) {
    return generateTrendChartGeneric(newOptions, storeData, context, severityTrendDataAccessor);
  }
};

export const generateBarChart = (
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
): BarChartData | undefined => {
  const newOptions = { limit: DEFAULT_CHART_HISTORY_LIMIT, ...options };
  const { dataType } = newOptions;

  if (dataType === BarChartType.StatusBySeverity) {
    return generateBarChartGeneric(newOptions, storeData, statusBySeverityBarDataAccessor);
  } else if (dataType === BarChartType.StatusTrend) {
    return generateBarChartGeneric(newOptions, storeData, statusTrendBarAccessor);
  } else if (dataType === BarChartType.StatusChangeTrend) {
    return generateBarChartGeneric(newOptions, storeData, statusChangeTrendBarAccessor);
  }
};

export const defaultChartsConfig = [
  {
    type: "pie",
    title: "Current status"
  },
  {
    type: "trend",
    dataType: "status",
    title: "Status dynamics"
  },
  {
    type: "bar",
    dataType: "statusBySeverity",
    title: "Test result severities"
  },
  {
    type: "bar",
    dataType: "statusTrend",
    title: "Status change dynamics"
  },
  {
    type: "bar",
    dataType: "statusChangeTrend",
    title: "Test base growth dynamics"
  },
  {
    type: "treemap",
    dataType: "coverageDiff",
    title: "Coverage diff map"
  },
  {
    type: "treemap",
    dataType: "successRateDistribution",
    title: "Success rate disctribution"
  },
  {
    type: "heatmap",
    title: "Problems distribution by environment"
  },
  {
    type: "bar",
    title: "Stability rate disctribution"
  },
  {
    type: "bar",
    title: "Duration by layer histogram"
  },
  {
    type: "bar",
    title: "Performance dynamics"
  },
  {
    type: "bar",
    title: "FBSU age pyramid"
  },
  {
    type: "funnel",
    title: "Testing pyramid"
  },
];
