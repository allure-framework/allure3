import type { HistoryDataPoint, SeverityLevel, TestResult } from "@allurereport/core-api";
import { severityLabelName, severityLevels } from "@allurereport/core-api";
import type { SeverityTrendChartData, TrendChartOptions } from "../model.js";
import {
  createEmptySeries,
  createEmptyStats,
  getTrendDataGeneric,
  mergeTrendDataGeneric,
  normalizeStatistic,
} from "../utils/trend.js";

export const getSeverityTrendData = (
  testResults: TestResult[],
  reportName: string,
  historyPoints: HistoryDataPoint[],
  chartOptions: TrendChartOptions,
): SeverityTrendChartData => {
  const { limit } = chartOptions;
  const historyLimit = limit && limit > 0 ? Math.max(0, limit - 1) : undefined;

  // Apply limit to history points if specified
  const limitedHistoryPoints = historyLimit !== undefined ? historyPoints.slice(-historyLimit) : historyPoints;

  // Convert history points to statistics by severity
  const firstOriginalIndex = historyLimit !== undefined ? Math.max(0, historyPoints.length - historyLimit) : 0;
  const convertedHistoryPoints = limitedHistoryPoints.map((point, index) => {
    const originalIndex = firstOriginalIndex + index;

    return {
      name: point.name,
      originalIndex,
      statistic: Object.values(point.testResults).reduce((stat, test) => {
        const severityLabel = test.labels?.find((label) => label.name === severityLabelName);
        const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

        if (severity) {
          stat[severity] = (stat[severity] ?? 0) + 1;
        }

        return stat;
      }, createEmptyStats(severityLevels)),
    };
  });

  // Get current severity statistics
  const currentSeverityStats = testResults.reduce((acc, test) => {
    const severityLabel = test.labels.find((label) => label.name === severityLabelName);
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity) {
      acc[severity] = (acc[severity] ?? 0) + 1;
    }

    return acc;
  }, createEmptyStats(severityLevels));

  // Get current report data
  const currentTrendData = getTrendDataGeneric(
    normalizeStatistic(currentSeverityStats, severityLevels),
    reportName,
    historyPoints.length + 1, // Always use the full history length for current point order
    severityLevels,
    chartOptions,
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduce(
    (acc, historyPoint) => {
      const trendDataPart = getTrendDataGeneric(
        normalizeStatistic(historyPoint.statistic, severityLevels),
        historyPoint.name,
        historyPoint.originalIndex + 1,
        severityLevels,
        chartOptions,
      );

      return mergeTrendDataGeneric(acc, trendDataPart, severityLevels);
    },
    {
      type: chartOptions.type,
      dataType: chartOptions.dataType,
      title: chartOptions.title,
      points: {},
      slices: {},
      series: createEmptySeries(severityLevels),
      min: Infinity,
      max: -Infinity,
    } as SeverityTrendChartData,
  );

  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, severityLevels);
};
