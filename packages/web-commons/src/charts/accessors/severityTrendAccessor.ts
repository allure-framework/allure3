import type { TrendDataAccessor, TrendStats } from "@allurereport/charts-api";
import type { HistoryTestResult, SeverityLevel, TestResult } from "@allurereport/core-api";
import { severityLabelName, severityLevels } from "@allurereport/core-api";
import { createEmptyStats } from "../chart-utils.js";

type SeverityTrendStats = TrendStats<SeverityLevel>;

const processTestResults = (testResults: (TestResult | HistoryTestResult)[]): SeverityTrendStats => {
  return testResults.reduce((acc: SeverityTrendStats, test: TestResult | HistoryTestResult) => {
    const severityLabel = test.labels?.find((label: { name: string }) => label.name === severityLabelName);
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity) {
      acc[severity] = (acc[severity] ?? 0) + 1;
    }

    return acc;
  }, createEmptyStats(severityLevels));
};

export const severityTrendDataAccessor: TrendDataAccessor<SeverityLevel> = {
  getCurrentData: ({ testResults }) => {
    return processTestResults(testResults);
  },
  getHistoricalData: (historyPoint) => {
    return processTestResults(Object.values(historyPoint.testResults));
  },
  getAllValues: () => severityLevels,
};
