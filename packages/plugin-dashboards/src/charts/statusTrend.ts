import type { HistoryDataPoint, Statistic } from "@allurereport/core-api";
import type { ChartOptions, StatusTrendChartData } from "../types.js";
import {
  STATUS_LIST,
  createEmptySeries,
  getTrendDataGeneric,
  mergeTrendDataGeneric,
  normalizeStatistic,
} from "../utils/trend.js";

export const getStatusTrendData = (
  currentStatistic: Statistic,
  reportName: string,
  historyPoints: HistoryDataPoint[],
  chartOptions: ChartOptions,
): StatusTrendChartData => {
  const { limit } = chartOptions;

  // Apply limit to history points if specified
  const limitedHistoryPoints = limit
    ? historyPoints.slice(-limit)
    : historyPoints;

  // Convert history points to statistics
  const convertedHistoryPoints = limitedHistoryPoints.map((point) => ({
    name: point.name,
    statistic: Object.values(point.testResults).reduce(
      (stat: Statistic, test) => {
        if (test.status) {
          stat[test.status] = (stat[test.status] ?? 0) + 1;
          stat.total = (stat.total ?? 0) + 1;
        }

        return stat;
      },
      { total: 0 } as Statistic,
    ),
  }));

  // Get current report data
  const currentTrendData = getTrendDataGeneric(
    normalizeStatistic(currentStatistic),
    reportName,
    convertedHistoryPoints.length + 1,
    STATUS_LIST,
    chartOptions
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduceRight(
    (acc, historyPoint, index) => {
      const trendDataPart = getTrendDataGeneric(
        normalizeStatistic(historyPoint.statistic),
        historyPoint.name,
        convertedHistoryPoints.length - index,
        STATUS_LIST,
        chartOptions
      );

      return mergeTrendDataGeneric(acc, trendDataPart, STATUS_LIST);
    },
    {
      type: chartOptions.type,
      title: chartOptions.title,
      points: {},
      slices: {},
      series: createEmptySeries(STATUS_LIST),
      min: Infinity,
      max: -Infinity,
    } as StatusTrendChartData,
  );

  // Add current report data as the last item
  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, STATUS_LIST);
};
