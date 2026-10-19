import {
  type HistoryTestResult,
  type FlakyDetectionConfig,
  type TestResult,
  getTestFlakiness,
} from "@allurereport/core-api";

export const createFlakyDetector =
  ({ includePassedTests = false, historyDepth, stabilizationPeriod }: FlakyDetectionConfig = {}) =>
  (tr: TestResult, history: (HistoryTestResult | undefined)[]): boolean => {
    if (tr.status !== "failed" && tr.status !== "broken" && !(includePassedTests && tr.status === "passed")) {
      return false;
    }
    return getTestFlakiness(tr, history, { historyDepth, stabilizationPeriod }) === true;
  };
