import type { TestStatus } from "../model.js";

export const StatusByPriority: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];

export const statusToPriority = (status: TestStatus | undefined) => {
  if (!status) {
    return -1;
  }

  return StatusByPriority.indexOf(status);
};

export const getWorstStatus = <T>(
  items: T[],
  statusAccessor: (item: T) => TestStatus = (item: T) => item as TestStatus,
): TestStatus | undefined => {
  if (items.length === 0) {
    return;
  }

  return items.map((item) => statusAccessor(item)).sort((a, b) => statusToPriority(a) - statusToPriority(b))[0];
};
