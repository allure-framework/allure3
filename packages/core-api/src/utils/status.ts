import type { TestResult, TestStatus } from "../model.js";

const retryStatusChangeStatuses = new Set<TestStatus>(["failed", "broken", "passed"]);

export const StatusByPriority: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];

export const statusToPriority = (status: TestStatus | undefined) => {
  if (!status) {
    return -1;
  }

  return StatusByPriority.indexOf(status);
};

export const getWorstStatus = (items: TestStatus[]): TestStatus | undefined => {
  if (items.length === 0) {
    return;
  }

  return items.sort((a, b) => statusToPriority(a) - statusToPriority(b))[0];
};

export const hasRetriesStatusChange = (
  current: Pick<TestResult, "status">,
  retries: readonly Pick<TestResult, "status">[],
): boolean =>
  retryStatusChangeStatuses.has(current.status) &&
  retries.some(({ status }) => retryStatusChangeStatuses.has(status) && status !== current.status);
