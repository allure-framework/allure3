import type { HistoryDataPoint, Statistic } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { StatusTrendChartData, TrendChartOptions } from "../model.js";
import {
  createEmptySeries,
  createEmptyStats,
  getTrendDataGeneric,
  mergeTrendDataGeneric,
  normalizeStatistic,
} from "../utils/trend.js";

export const getStatusTrendData = (
  currentStatistic: Statistic,
  reportName: string,
  historyPoints: HistoryDataPoint[],
  chartOptions: TrendChartOptions,
): StatusTrendChartData => {
  const { limit } = chartOptions;

  // Apply limit to history points if specified
  const limitedHistoryPoints = limit
    ? historyPoints.slice(-limit)
    : historyPoints;

  // Convert history points to statistics
  const convertedHistoryPoints = limitedHistoryPoints.map((point, index) => {
    const originalIndex = limit ? historyPoints.length - limit + index : index;

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
    (limit ? Math.max(historyPoints.length, limit) : historyPoints.length) + 1,
    statusesList,
    chartOptions
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduce(
    (acc, historyPoint) => {
      const trendDataPart = getTrendDataGeneric(
        normalizeStatistic(historyPoint.statistic, statusesList),
        historyPoint.name,
        historyPoint.originalIndex + 1,
        statusesList,
        chartOptions
      );

      return mergeTrendDataGeneric(acc, trendDataPart, statusesList);
    },
    {
      type: chartOptions.type,
      dataType: chartOptions.dataType,
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
