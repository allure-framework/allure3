import type { HistoryTestResult, TestResult, TestStatusTransition } from "@allurereport/core-api";

const NON_MEANINGFUL_HISTORY_STATUSES = ["unknown", "skipped"];

export const isNew = (history: HistoryTestResult[] = []) => history.length === 0;

const getMeaningfulHistory = (history: HistoryTestResult[] = []): HistoryTestResult[] =>
  history.filter((htr) => !NON_MEANINGFUL_HISTORY_STATUSES.includes(htr.status));

/**
 * @description Checks if the test result is switched to another meaningful status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is switched to a new status, `false` otherwise.
 */
export const isHistoricallyNew = (tr: TestResult, history: HistoryTestResult[] = []) => {
  const meaningfulHistory = getMeaningfulHistory(history);

  // If status is only current on the test result, it is new.
  if (meaningfulHistory.length === 0) {
    return true;
  }

  return meaningfulHistory[meaningfulHistory.length - 1].status !== tr.status;
};

export const isFixed = (tr: TestResult, history: HistoryTestResult[] = []) =>
  isHistoricallyNew(tr, history) && tr.status === "passed";

export const isRegressed = (tr: TestResult, history: HistoryTestResult[] = []) =>
  isHistoricallyNew(tr, history) && tr.status === "failed";

export const isMalfunctioned = (tr: TestResult, history: HistoryTestResult[] = []) =>
  isHistoricallyNew(tr, history) && tr.status === "broken";

export const getStatusTransition = (
  tr: TestResult,
  history: HistoryTestResult[] = [],
): TestStatusTransition | undefined => {
  const meaningfulHistory = getMeaningfulHistory(history);

  if (isNew(meaningfulHistory)) {
    return "new";
  } else if (isFixed(tr, history)) {
    return "fixed";
  } else if (isRegressed(tr, history)) {
    return "regressed";
  } else if (isMalfunctioned(tr, history)) {
    return "malfunctioned";
  }
};
