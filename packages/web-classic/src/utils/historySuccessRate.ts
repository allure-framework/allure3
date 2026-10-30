import type { HistoryTestResult, TestStatus } from "@allurereport/core-api";

export type HistorySuccessRate = {
  passed: number;
  total: number;
  /** percentage of passed runs rounded to 2 decimal places */
  rate: number;
};

/**
 * Calculates the success rate of the test across its history like Allure 2 does:
 * the current run is counted together with the previous runs and every status takes part in the total.
 */
export const getHistorySuccessRate = (
  currentStatus: TestStatus | undefined,
  history: Pick<HistoryTestResult, "status">[] = [],
): HistorySuccessRate | undefined => {
  const statuses = [...(currentStatus ? [currentStatus] : []), ...history.map(({ status }) => status)];
  const total = statuses.length;

  if (!total) {
    return undefined;
  }

  const passed = statuses.filter((status) => status === "passed").length;

  return {
    passed,
    total,
    rate: Math.round((passed / total) * 10000) / 100,
  };
};
