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
  TestStatus,
  TrendPoint,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
} from "@allurereport/core-api";
import { ChartDataType, ChartMode, ChartType, getPieChartValues } from "@allurereport/core-api";
import type { PluginContext } from "./plugin.js";
import { severityTrendDataAccessor } from "./severityTrendAccessor.js";
import { statusBySeverityBarDataAccessor } from "./statusBySeverityBarAccessor.js";
import { statusTrendDataAccessor } from "./statusTrendAccessor.js";
import type { AllureStore } from "./store.js";

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
export interface GenericTrendChartData<SeriesType extends string, Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
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

// Union types for generated chart data
export type GeneratedChartData = TrendChartData | PieChartData;
export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

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

export type ChartOptions = TrendChartOptions | PieChartOptions;

export interface PieChartData {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
}

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
export const createEmptyStats = <T extends TrendDataType>(items: readonly T[]): Record<T, number> =>
    items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

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
