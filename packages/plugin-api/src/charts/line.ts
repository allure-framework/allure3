import type { BaseTrendSliceMetadata, HistoryDataPoint, TrendPoint, TrendPointId } from "@allurereport/core-api";
import { ChartMode, ChartDataType } from "@allurereport/core-api";
import type { TrendDataType, TrendCalculationResult, TrendChartOptions, GenericTrendChartData, AllureChartsStoreData, TrendDataAccessor, TrendChartData } from "../charts.js";
import { createEmptySeries, normalizeStatistic, DEFAULT_CHART_HISTORY_LIMIT } from "../charts.js";
import type { PluginContext } from "../plugin.js";
import { statusTrendDataAccessor } from "./accessors/statusTrendAccessor.js";
import { severityTrendDataAccessor } from "./accessors/severityTrendAccessor.js";

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
