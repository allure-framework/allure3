import type { BarGroup, HistoryDataPoint, TestStatus } from "@allurereport/core-api";
import { BarGroupMode } from "@allurereport/core-api";
import type { BarDataAccessor } from "./charts.js";

// Types for test statuses diff trend chart data
export type TestStatusesDiffTrendKeys = "newPassed"
  | "removedPassed"
  | "newFailed"
  | "removedFailed"
  | "newBroken"
  | "removedBroken";

export type TestStatusesDiffTrendGroupId = string;

// Helper functions to get diff keys based on status
const getNewKey = (status: TestStatus): TestStatusesDiffTrendKeys | undefined => {
  if (status === "passed") {
    return "newPassed";
  }
  if (status === "failed") {
    return "newFailed";
  }
  if (status === "broken") {
    return "newBroken";
  }
};

const getRemovedKey = (status: TestStatus): TestStatusesDiffTrendKeys | undefined => {
  if (status === "passed") {
    return "removedPassed";
  }
  if (status === "failed") {
    return "removedFailed";
  }
  if (status === "broken") {
    return "removedBroken";
  }
};

// Helper function to create empty stats
const createEmptyStats = (): Record<TestStatusesDiffTrendKeys, number> => ({
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
  currentTests: Record<string, { status: TestStatus }>
): Record<TestStatusesDiffTrendKeys, number> => {
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

  // Find status changes
  for (const testId of currentIds) {
    if (previousIds.has(testId)) {
      const currentTest = currentTests[testId];
      const previousTest = previousTests[testId];

      if (currentTest?.status && previousTest?.status && currentTest.status !== previousTest.status) {
        // New status
        const newKey = getNewKey(currentTest.status);
        if (newKey) {
          stats[newKey]++;
        }

        // Removed status
        const removedKey = getRemovedKey(previousTest.status);
        if (removedKey) {
          stats[removedKey]--;
        }
      }
    }
  }

  return stats;
};

const calculateTrendData = (historyPoints: HistoryDataPoint[]): BarGroup<TestStatusesDiffTrendGroupId, TestStatusesDiffTrendKeys>[] => {
  if (historyPoints.length === 0) {
    return [];
  }

  const trendData: BarGroup<TestStatusesDiffTrendGroupId, TestStatusesDiffTrendKeys>[] = [];

  // Process each history point
  for (let i = 0; i < historyPoints.length; i++) {
    const currentHistoryPoint = historyPoints[i];
    const previousHistoryPoint = i > 0 ? historyPoints[i - 1] : null;

    let stats: Record<TestStatusesDiffTrendKeys, number>;
    if (previousHistoryPoint) {
      // Compare with previous point
      stats = compareTestResults(previousHistoryPoint.testResults, currentHistoryPoint.testResults);
    } else {
      // First point - all tests are new
      stats = compareTestResults({}, currentHistoryPoint.testResults);
    }

    trendData.push({
      groupId: `Point ${i + 1}`,
      ...stats,
    });
  }

  return trendData;
};

export const testStatusesDiffTrendDataAccessor: BarDataAccessor<TestStatusesDiffTrendGroupId, TestStatusesDiffTrendKeys> = {
  getItems: async (store, historyPoints) => {
    const testResults = await store.allTestResults();
    const trendData = calculateTrendData(historyPoints);

    // Add current data point if we have history
    const lastHistoryPoint = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1] : null;
    const lastHistoryTestResults = lastHistoryPoint?.testResults ?? {};

    // Convert current test results to the format expected by compareTestResults
    const currentTests = testResults.reduce((acc, test) => {
      acc[test.id] = { status: test.status };
      return acc;
    }, {} as Record<string, { status: TestStatus }>);

    const currentStats = compareTestResults(lastHistoryTestResults, currentTests);

    trendData.push({
      groupId: "current",
      ...currentStats,
    });

    return trendData;
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
