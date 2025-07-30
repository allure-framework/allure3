import type { HistoryDataPoint, Statistic, TrendChartOptions } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { StatusTrendChartData } from "../charts.js";
import {
  createEmptySeries,
  createEmptyStats,
  getTrendDataGeneric,
  mergeTrendDataGeneric,
  normalizeStatistic,
} from "../charts.js";

export const getStatusTrendData = (
  currentStatistic: Statistic,
  reportName: string,
  historyPoints: HistoryDataPoint[],
  chartOptions: TrendChartOptions,
): StatusTrendChartData => {
  const { limit } = chartOptions;
  const historyLimit = limit && limit > 0 ? Math.max(0, limit - 1) : undefined;

  // Apply limit to history points if specified
  const limitedHistoryPoints = historyLimit !== undefined ? historyPoints.slice(-historyLimit) : historyPoints;

  // Convert history points to statistics
  const firstOriginalIndex = historyLimit !== undefined ? Math.max(0, historyPoints.length - historyLimit) : 0;
  const convertedHistoryPoints = limitedHistoryPoints.map((point, index) => {
    const originalIndex = firstOriginalIndex + index;

    return {
      name: point.name,
      originalIndex,
      statistic: Object.values(point.testResults).reduce(
        (stat: Statistic, test) => {
          if (test.status) {
            stat[test.status] = (stat[test.status] ?? 0) + 1;
            stat.total = (stat.total ?? 0) + 1;
          }

          return stat;
        },
        { total: 0, ...createEmptyStats(statusesList) } as Statistic,
      ),
    };
  });

  // Get current report data
  const currentTrendData = getTrendDataGeneric(
    normalizeStatistic(currentStatistic, statusesList),
    reportName,
    historyPoints.length + 1, // Always use the full history length for current point order
    statusesList,
    chartOptions,
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduce(
    (acc, historyPoint) => {
      const trendDataPart = getTrendDataGeneric(
        normalizeStatistic(historyPoint.statistic, statusesList),
        historyPoint.name,
        historyPoint.originalIndex + 1,
        statusesList,
        chartOptions,
      );

      return mergeTrendDataGeneric(acc, trendDataPart, statusesList);
    },
    {
      type: chartOptions.type,
      dataType: chartOptions.dataType,
      mode: chartOptions.mode,
      title: chartOptions.title,
      points: {},
      slices: {},
      series: createEmptySeries(statusesList),
      min: Infinity,
      max: -Infinity,
    } as StatusTrendChartData,
  );

  // Add current report data as the last item
  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, statusesList);
};
