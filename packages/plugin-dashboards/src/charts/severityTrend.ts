import type { HistoryDataPoint, SeverityLevel, TestResult } from "@allurereport/core-api";
import type { ChartOptions, SeverityTrendChartData } from "../types.js";
import {
  SEVERITY_LIST,
  createEmptySeries,
  createEmptyStats,
  getTrendDataGeneric,
  mergeTrendDataGeneric,
} from "../utils/trend.js";

export const getSeverityTrendData = (
  testResults: TestResult[],
  reportName: string,
  historyPoints: HistoryDataPoint[],
  chartOptions: ChartOptions,
): SeverityTrendChartData => {
  // Apply limit to history points if specified
  const limitedHistoryPoints = chartOptions.limit
    ? historyPoints.slice(-chartOptions.limit)
    : historyPoints;

  // Convert history points to statistics by severity
  const convertedHistoryPoints = limitedHistoryPoints.map((point) => ({
    name: point.name,
    statistic: Object.values(point.testResults).reduce((stat, test) => {
      const severityLabel = test.labels?.find((label) => label.name === "severity");
      const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

      if (severity) {
        stat[severity] = (stat[severity] ?? 0) + 1;
      }

      return stat;
    }, createEmptyStats(SEVERITY_LIST)),
  }));

  // Get current severity statistics
  const currentSeverityStats = testResults.reduce((acc, test) => {
    const severityLabel = test.labels.find((label) => label.name === "severity");
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity) {
      acc[severity] = (acc[severity] ?? 0) + 1;
    }

    return acc;
  }, createEmptyStats(SEVERITY_LIST));

  // Get current report data
  const currentTrendData = getTrendDataGeneric(
    currentSeverityStats,
    reportName,
    convertedHistoryPoints.length + 1,
    SEVERITY_LIST,
    chartOptions
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduceRight(
    (acc, historyPoint, index) => {
      const trendDataPart = getTrendDataGeneric(
        historyPoint.statistic,
        historyPoint.name,
        convertedHistoryPoints.length - index,
        SEVERITY_LIST,
        chartOptions
      );

      return mergeTrendDataGeneric(acc, trendDataPart, SEVERITY_LIST);
    },
    {
      type: chartOptions.type,
      points: {},
      slices: {},
      series: createEmptySeries(SEVERITY_LIST),
      min: Infinity,
      max: -Infinity,
    } as SeverityTrendChartData,
  );

  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, SEVERITY_LIST);
};
