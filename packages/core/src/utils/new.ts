import type { TestResult, TestStatusTransition } from "@allurereport/core-api";

type TrWithStatus = Pick<TestResult, "status">;

const NON_SIGNIFICANT_HISTORY_STATUSES = ["unknown", "skipped"];

/**
 * @description Checks if the test result is freshely new in a report.
 * @param history - The history of test results.
 * @returns `true` if the test result is new, `false` otherwise.
 */
export const isNew = (history: TrWithStatus[] = []) => history.length === 0;

/**
 * @description Checks if the history test result has a significant status.
 * @param htr - The history test result to check.
 * @returns `true` if the history test result has a significant status, `false` otherwise.
 */
const hasSignificantStatus = (htr: TrWithStatus) => !NON_SIGNIFICANT_HISTORY_STATUSES.includes(htr.status);

/**
 * @description Gets the most recent significant status from test history.
 * @param history - The history of test results
 * @returns The most recent significant status or undefined if none found
 */
export const getLastSignificantStatus = (history: TrWithStatus[] = []): string | undefined => {
  const significantHtr = history.find(hasSignificantStatus);

  return significantHtr?.status;
};

/**
 * @description Gets the status transition of the test result if any.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns The status transition of the test result.
 */
export const getStatusTransition = (
  tr: TrWithStatus,
  history: TrWithStatus[] = [],
): TestStatusTransition | undefined => {
  if (isNew(history)) {
    return "new";
  }

  const lastStatus = getLastSignificantStatus(history);

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
