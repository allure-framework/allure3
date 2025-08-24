import type { BarGroup, HistoryDataPoint, NewKey, RemovedKey, TestStatus } from "@allurereport/core-api";
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
  currentTests: Record<string, { status: TestStatus }>
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

const calculateTrendData = (historyPoints: HistoryDataPoint[]): BarGroup<StatusChangeTrendGroupId, StatusChangeTrendKeys>[] => {
  if (historyPoints.length === 0) {
    return [];
  }

  const trendData: BarGroup<StatusChangeTrendGroupId, StatusChangeTrendKeys>[] = [];

  // Process each history point
  for (let i = 0; i < historyPoints.length; i++) {
    const previousHistoryPoint = i > 0 ? historyPoints[i - 1] : null;
    const currentHistoryPoint = historyPoints[i];

    let stats: Record<StatusChangeTrendKeys, number>;
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

export const statusChangeTrendBarAccessor: BarDataAccessor<StatusChangeTrendGroupId, StatusChangeTrendKeys> = {
  getItems: async (store, historyPoints) => {
    const testResults = await store.allTestResults();
    const trendData = calculateTrendData(historyPoints);

    console.log("historyPoints", historyPoints.map(point => new Date(point.timestamp).toISOString()));

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
