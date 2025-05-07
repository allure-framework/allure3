import type { HistoryTestResult, TestResult } from "@allurereport/core-api";

export const isNew = (tr: TestResult, history?: HistoryTestResult[]) => {
  if (!history || history.length === 0) {
    return true;
  }

  return !history.some((h) => h.id === tr.historyId);
};
