import type { HistoryDataPoint, TestStatus, BarGroup, TestResult, HistoryTestResult } from "@allurereport/core-api";
import { BarGroupMode } from "@allurereport/core-api";
import { type BarDataAccessor, createEmptyStats } from "./charts.js";

type TrendKey = "passed" | "failed" | "broken";
type TrendStats = Record<TrendKey, number>;
type TestStatuses = Record<string, { status: TestStatus }>;

const groupKeys = ["passed", "failed", "broken"] as const;
const emptyStats = createEmptyStats(groupKeys);
const NON_SIGNIFICANT_HISTORY_STATUSES = ["unknown", "skipped"];

const isGroupKey = (key: string): key is TrendKey => groupKeys.includes(key as TrendKey);

const getSignedValueByStatus = (status: TestStatus): number => status === "passed" ? 1 : -1;

/**
 * @description Checks if the history test result has a significant status.
 * @param htr - The history test result to check.
 * @returns `true` if the history test result has a significant status, `false` otherwise.
 */
const hasSignificantStatus = (htr: HistoryTestResult) => !NON_SIGNIFICANT_HISTORY_STATUSES.includes(htr.status);

/**
 * @description Gets the most recent significant status from test history.
 * @param history - The history of test results
 * @returns The most recent significant status or undefined if none found
 */
export const getLastSignificantStatus = (history: HistoryTestResult[] = []): string | undefined => {
  const significantHtr = history.find(hasSignificantStatus);

  return significantHtr?.status;
};

const getTestStatuses = (testResults: (TestResult | HistoryTestResult)[]): TestStatuses => testResults.reduce((acc, test) => {
  acc[test.id] = { status: test.status };

  return acc;
}, {} as TestStatuses);

const compareTestResults = (
  previousTests: Record<string, { status: TestStatus }>,
  currentTests: Record<string, { status: TestStatus }>,
): TrendStats => {
  const stats = { ...emptyStats };

  const currentIds = new Set(Object.keys(currentTests));
  const previousIds = new Set(Object.keys(previousTests));

  // Find status changes for existing items in both previous and current points
  for (const testId of currentIds) {
    if (previousIds.has(testId)) {
      const currentTest = currentTests[testId];
      const previousTest = previousTests[testId];

      if (currentTest?.status && previousTest?.status && currentTest.status !== previousTest.status) {
        if (isGroupKey(currentTest.status) && isGroupKey(previousTest.status)) {
          stats[currentTest.status] = stats[currentTest.status] + getSignedValueByStatus(currentTest.status);
        }
      }
    }
  }

  return stats;
};

const getTrendData = (testResults: TestResult[], historyPoints: HistoryDataPoint[]): BarGroup<string, TrendKey>[] => {
  const currentTestStatuses = getTestStatuses(testResults);
  const historyAndCurrentTestResults = [{ testResults: currentTestStatuses }, ...historyPoints];

  const trendData: BarGroup<string, TrendKey>[] = [];
  for (let i = 0; i < historyAndCurrentTestResults.length; i++) {
    const previousHistoryPoint = i + 1 < historyAndCurrentTestResults.length ? historyAndCurrentTestResults[i + 1] : { testResults: {} };
    const currentHistoryPoint = historyAndCurrentTestResults[i];
    const pointIndex = historyAndCurrentTestResults.length - i - 1;

    trendData.push({
      groupId: i === 0 ? "current" : `Point ${pointIndex}`,
      ...compareTestResults(previousHistoryPoint.testResults, currentHistoryPoint.testResults),
    });
  }

  return trendData;
};

export const statusTrendBarAccessor: BarDataAccessor<string, TrendKey> = {
  getItems: async (store, historyPoints, isFullHistory) => {
    const testResults = await store.allTestResults();

    let trendData = getTrendData(testResults, historyPoints);

    /* This is necessary not to exclude the last point that have been compared with the empty stats if the history is fully provided.
    *
    * We have no previous poin in the end of the full history, that's why we have to compare it with the empty stats.
    * At the opposite, we have to exclude the last point if the history is limited because it should be compared with the real previous point,
    * but it is already excluded in limited history.
    */
    if (!isFullHistory) {
      trendData = trendData.slice(0, -1);
    }

    return trendData.reverse();
  },
  getGroupKeys: () => groupKeys,
  getGroupMode: () => BarGroupMode.Stacked,
};


