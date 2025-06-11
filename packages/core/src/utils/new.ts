import type { HistoryTestResult, TestResult, TestStatusTransition } from "@allurereport/core-api";

const NON_SIGNIFICANT_HISTORY_STATUSES = ["unknown", "skipped"];

/**
 * @description Checks if the test result is freshely new in a report.
 * @param history - The history of test results.
 * @returns `true` if the test result is new, `false` otherwise.
 */
export const isNew = (history: HistoryTestResult[] = []) => history.length === 0;

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

/**
 * @description Checks if the test result is switched to another significant status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is switched to a new status, `false` otherwise.
 */
export const hasStatusTransition = (tr: TestResult, history: HistoryTestResult[] = []) => {
  const lastStatus = getLastSignificantStatus(history);

  return !lastStatus || lastStatus !== tr.status;
};

/**
 * @description Checks if the test result is changed to passed status from another status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is in fixed transition status, `false` otherwise.
 */
export const isFixed = (tr: TestResult, history: HistoryTestResult[] = []) =>
  hasStatusTransition(tr, history) && tr.status === "passed";

/**
 * @description Checks if the test result is changed to failed status from another status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is in regressed transition status, `false` otherwise.
 */
export const isRegressed = (tr: TestResult, history: HistoryTestResult[] = []) =>
  hasStatusTransition(tr, history) && tr.status === "failed";

/**
 * @description Checks if the test result is changed to broken status from another status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is in malfunctioned transition status, `false` otherwise.
 */
export const isMalfunctioned = (tr: TestResult, history: HistoryTestResult[] = []) =>
  hasStatusTransition(tr, history) && tr.status === "broken";

/**
 * @description Gets the status transition of the test result if any.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns The status transition of the test result.
 */
export const getStatusTransition = (
  tr: TestResult,
  history: HistoryTestResult[] = [],
): TestStatusTransition | undefined => {
  const lastStatus = getLastSignificantStatus(history);

  if (!lastStatus) {
    return "new";
  }

  if (lastStatus !== tr.status) {
    switch (tr.status) {
      case "passed":
        return "fixed";
      case "failed":
        return "regressed";
      case "broken":
        return "malfunctioned";
    }
  }
};
