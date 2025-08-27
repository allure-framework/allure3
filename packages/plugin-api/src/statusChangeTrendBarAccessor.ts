import type { BarGroup, HistoryDataPoint, NewKey, RemovedKey, TestResult, TestStatus } from "@allurereport/core-api";
import { BarGroupMode } from "@allurereport/core-api";
import { createEmptyStats, type BarDataAccessor } from "./charts.js";

// Types for new statuses trend chart data
export type TrendKeys = Extract<TestStatus, "passed" | "failed" | "broken">;
export type StatusChangeTrendKeys = NewKey<TrendKeys> | RemovedKey<TrendKeys>;

const groupKeys = ["newPassed", "removedPassed", "newFailed", "removedFailed", "newBroken", "removedBroken"] as const;
const emptyStats = createEmptyStats(groupKeys);

// Helper functions to get diff keys based on status
const getNewKey = (status: TestStatus): StatusChangeTrendKeys | undefined => {
  if (status === "passed") {
    return "newPassed";
  } else if (status === "failed") {
    return "newFailed";
  } else if (status === "broken") {
    return "newBroken";
  }
};

const getRemovedKey = (status: TestStatus): StatusChangeTrendKeys | undefined => {
  if (status === "passed") {
    return "removedPassed";
  } else if (status === "failed") {
    return "removedFailed";
  } else if (status === "broken") {
    return "removedBroken";
  }
};

// Helper function to compare two sets of test results and calculate differences
const compareTestResults = (
  previousTests: Record<string, { status: TestStatus }>,
  currentTests: Record<string, { status: TestStatus }>,
): Record<StatusChangeTrendKeys, number> => {
  const stats = { ...emptyStats };

  const currentIds = new Set(Object.keys(currentTests));
  const previousIds = new Set(Object.keys(previousTests));

  // Find new tests
  for (const testId of currentIds) {
    if (!previousIds.has(testId)) {
      const test = currentTests[testId];
      if (test?.status) {
        const key = getNewKey(test.status);
        if (key) {
          stats[key]++;
        }
      }
    }
  }

  // Find removed tests
  for (const testId of previousIds) {
    if (!currentIds.has(testId)) {
      const test = previousTests[testId];
      if (test?.status) {
        const key = getRemovedKey(test.status);
        if (key) {
          stats[key]--;
        }
      }
    }
  }

  // Find status changes for existing items in both previous and current points
  for (const testId of currentIds) {
    if (previousIds.has(testId)) {
      const currentTest = currentTests[testId];
      const previousTest = previousTests[testId];

      if (currentTest?.status && previousTest?.status && currentTest.status !== previousTest.status) {
        // Somewhere it was removed and added in another status, so you have to handle both cases simultaneously for the same item
        // Add new status for existing item
        const newKey = getNewKey(currentTest.status);
        if (newKey) {
          stats[newKey]++;
        }

        // Add removed status for previous item
        const removedKey = getRemovedKey(previousTest.status);
        if (removedKey) {
          stats[removedKey]--;
        }
      }
    }
  }

  return stats;
};

const calculateTrendData = (testResults: TestResult[], historyPoints: HistoryDataPoint[]): BarGroup<string, StatusChangeTrendKeys>[] => {
  // Convert current test results to the format expected by compareTestResults
  const currentTestResults = testResults.reduce((acc, test) => {
    acc[test.id] = { status: test.status };
    return acc;
  }, {} as Record<string, { status: TestStatus }>);

  const trendData: BarGroup<string, StatusChangeTrendKeys>[] = [];

  // Process each history point
  const historyAndCurrentItem = [{ testResults: currentTestResults }, ...historyPoints];

  for (let i = 0; i < historyAndCurrentItem.length; i++) {
    const previousHistoryPoint = i + 1 < historyAndCurrentItem.length ? historyAndCurrentItem[i + 1] : { testResults: {} };
    const currentHistoryPoint = historyAndCurrentItem[i];

    trendData.push({
      groupId: i === 0 ? "current" : `Point ${historyAndCurrentItem.length - i - 1}`,
      ...compareTestResults(previousHistoryPoint.testResults, currentHistoryPoint.testResults),
    });
  }

  return trendData;
};

export const statusChangeTrendBarAccessor: BarDataAccessor<string, StatusChangeTrendKeys> = {
  getItems: async (store, historyPoints, isFullHistory) => {
    const testResults = await store.allTestResults();

    let trendData = calculateTrendData(testResults, historyPoints);

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
