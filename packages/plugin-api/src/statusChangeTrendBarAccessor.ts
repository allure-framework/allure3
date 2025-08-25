import type { BarGroup, HistoryDataPoint, NewKey, RemovedKey, TestResult, TestStatus } from "@allurereport/core-api";
import { BarGroupMode } from "@allurereport/core-api";
import type { BarDataAccessor } from "./charts.js";

// Types for new statuses trend chart data
export type Keys = Extract<TestStatus, "passed" | "failed" | "broken">;
export type StatusChangeTrendKeys = NewKey<Keys> | RemovedKey<Keys>;

export type StatusChangeTrendGroupId = string;

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

// Helper function to create empty stats
const createEmptyStats = (): Record<StatusChangeTrendKeys, number> => ({
  newPassed: 0,
  removedPassed: 0,
  newFailed: 0,
  removedFailed: 0,
  newBroken: 0,
  removedBroken: 0,
});

// Helper function to compare two sets of test results and calculate differences
const compareTestResults = (
  previousTests: Record<string, { status: TestStatus }>,
  currentTests: Record<string, { status: TestStatus }>,
): Record<StatusChangeTrendKeys, number> => {
  const stats = createEmptyStats();
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

const calculateTrendData = (testResults: TestResult[], historyPoints: HistoryDataPoint[]): BarGroup<StatusChangeTrendGroupId, StatusChangeTrendKeys>[] => {
  // Convert current test results to the format expected by compareTestResults
  const currentTestResults = testResults.reduce((acc, test) => {
    acc[test.id] = { status: test.status };
    return acc;
  }, {} as Record<string, { status: TestStatus }>);

  const trendData: BarGroup<StatusChangeTrendGroupId, StatusChangeTrendKeys>[] = [];

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

export const statusChangeTrendBarAccessor: BarDataAccessor<StatusChangeTrendGroupId, StatusChangeTrendKeys> = {
  getItems: async (store, historyPoints) => {
    const testResults = await store.allTestResults();

    return calculateTrendData(testResults, historyPoints).slice(0, -1).reverse();
  },
  getGroupKeys: () => [
    "newPassed",
    "removedPassed",
    "newFailed",
    "removedFailed",
    "newBroken",
    "removedBroken"
  ] as const,
  getGroupMode: () => BarGroupMode.Stacked,
};
