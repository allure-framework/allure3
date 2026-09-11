import type { HistoryDataPoint, HistoryTestResult } from "../history.js";
import type { TestResult } from "../model.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeHistoryTestResults = (testResults: unknown): Record<string, HistoryTestResult> => {
  if (!isRecord(testResults)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(testResults).flatMap(([retryHash, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      const historyTestResult = { ...value };

      delete historyTestResult.historyId;

      return [
        [
          retryHash,
          {
            ...historyTestResult,
            retryHash,
          },
        ],
      ];
    }),
  ) as Record<string, HistoryTestResult>;
};

const normalizeHistoryMetrics = (metrics: unknown): Record<string, number> => {
  if (!isRecord(metrics)) {
    return {};
  }

  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => Number.isFinite(value))) as Record<
    string,
    number
  >;
};

export const normalizeHistoryDataPoint = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => ({
  ...historyDataPoint,
  knownTestCaseIds: Array.isArray(historyDataPoint.knownTestCaseIds) ? historyDataPoint.knownTestCaseIds : [],
  testResults: normalizeHistoryTestResults(historyDataPoint.testResults),
  metrics: normalizeHistoryMetrics(historyDataPoint.metrics),
  url: historyDataPoint.url ?? "",
});

export const normalizeHistoryDataPointUrls = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => {
  const normalizedHistoryDataPoint = normalizeHistoryDataPoint(historyDataPoint);
  const { url } = normalizedHistoryDataPoint;

  if (!url) {
    return normalizedHistoryDataPoint;
  }

  let testResults = normalizedHistoryDataPoint.testResults;

  for (const [retryHash, historyTestResult] of Object.entries(normalizedHistoryDataPoint.testResults)) {
    if (historyTestResult.url) {
      continue;
    }

    if (testResults === normalizedHistoryDataPoint.testResults) {
      testResults = { ...normalizedHistoryDataPoint.testResults };
    }

    testResults[retryHash] = {
      ...historyTestResult,
      url,
    };
  }

  if (testResults === normalizedHistoryDataPoint.testResults) {
    return normalizedHistoryDataPoint;
  }

  return {
    ...normalizedHistoryDataPoint,
    testResults,
  };
};

export const selectHistoryTestResults = (
  historyDataPoints: HistoryDataPoint[],
  retryHashes: readonly string[],
): HistoryTestResult[] => {
  if (retryHashes.length === 0) {
    return [];
  }

  return historyDataPoints.reduce((acc, historyDataPoint) => {
    for (const retryHash of retryHashes) {
      const historyTestResult = historyDataPoint.testResults?.[retryHash];

      if (!historyTestResult) {
        continue;
      }

      acc.push(historyTestResult);
      break;
    }

    return acc;
  }, [] as HistoryTestResult[]);
};

/**
 * @description Gets the historical test results for the test result.
 * @param hdps - The history data points.
 * @param tr - The test result or history test result.
 * @returns The history test results array.
 */
export const htrsByTr = (hdps: HistoryDataPoint[], tr: TestResult | HistoryTestResult): HistoryTestResult[] => {
  if (!tr?.retryHash) {
    return [];
  }

  return selectHistoryTestResults(hdps, [tr.retryHash]);
};
