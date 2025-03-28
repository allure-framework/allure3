import { severityLevels, statusesList } from "@allurereport/core-api";
import type { SeverityLevel, Statistic, TestStatus } from "@allurereport/core-api";
import type {
  BaseTrendSliceMetadata,
  ChartOptions,
  TrendChartData,
  TrendPoint,
  TrendPointId,
} from "../types.js";

// Common type for trend data operations
type TrendDataType = TestStatus | SeverityLevel;

// Type for calculation result
type TrendCalculationResult<T extends TrendDataType> = {
  points: Record<TrendPointId, TrendPoint>;
  series: Record<T, TrendPointId[]>;
};

// Constants for type safety
export const STATUS_LIST = statusesList as readonly TestStatus[];
export const SEVERITY_LIST = severityLevels as readonly SeverityLevel[];

// Helper for creating empty stats records
export const createEmptyStats = <T extends TrendDataType>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

// Helper for creating empty series records
export const createEmptySeries = <T extends TrendDataType>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

// Helper for converting Statistic to Record<TestStatus, number>
export const normalizeStatistic = (statistic: Statistic): Record<TestStatus, number> => {
  return STATUS_LIST.reduce(
    (acc, status) => {
      acc[status] = statistic[status] ?? 0;

      return acc;
    },
    {} as Record<TestStatus, number>,
  );
};

// Helper for calculating raw mode values
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

    if (value) {
      points[pointId] = {
        x: executionId,
        y: value,
      };

      series[item].push(pointId);
    }
  });

  return { points, series };
};

// Helper for calculating percent mode values
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

    if (value) {
      points[pointId] = {
        x: executionId,
        y: (value / total) * 100,
      };

      series[item].push(pointId);
    }
  });

  return { points, series };
};

// Helper for merging trend data
export const mergeTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  trendData: TrendChartData<M, T>,
  trendDataPart: TrendChartData<M, T>,
  itemType: readonly T[],
): TrendChartData<M, T> => {
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

// Helper for getting trend data
export const getTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  stats: Record<T, number>,
  reportName: string,
  executionOrder: number,
  itemType: readonly T[],
  chartOptions: ChartOptions,
): TrendChartData<M, T> => {
  const { type, title, mode = "raw", metadata = {} } = chartOptions;
  const { executionIdFn, executionNameFn } = metadata;
  const executionId = executionIdFn ? executionIdFn(executionOrder) : `execution-${executionOrder}`;

  const { points, series } = mode === "percent"
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
    const executionName = executionNameFn ? executionNameFn(executionOrder) : reportName;

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
    title,
    points,
    slices,
    series,
    min,
    max,
  };
};
