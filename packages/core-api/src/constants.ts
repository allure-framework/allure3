import type { Statistic } from "./aggregate.js";
import type { SeverityLevel, TestStatus } from "./model.js";

// TODO: use as a type in the tree filter store
export const statusesList: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];
export const severityLevels: SeverityLevel[] = ["blocker", "critical", "normal", "minor", "trivial"];

export const unsuccessfulStatuses = new Set<TestStatus>(["failed", "broken"]);

export const successfulStatuses = new Set<TestStatus>(["passed"]);

export const includedInSuccessRate = new Set<TestStatus>([...unsuccessfulStatuses, ...successfulStatuses]);

export const filterByStatus = <T extends { status: TestStatus }>(statuses: Iterable<TestStatus>) => {
  const set = new Set(statuses);
  return (t: T) => set.has(t.status);
};

export const filterSuccessful = filterByStatus(successfulStatuses);
export const filterUnsuccessful = filterByStatus(unsuccessfulStatuses);
export const filterIncludedInSuccessRate = filterByStatus(includedInSuccessRate);

export const emptyStatistic: () => Statistic = () => ({ total: 0 });

export const incrementStatistic = (statistic: Statistic, status: TestStatus, count: number = 1) => {
  statistic[status] = (statistic[status] ?? 0) + count;
  statistic.total += count;
};

export const mergeStatistic = (statistic: Statistic, additional: Statistic) => {
  statusesList.forEach((status) => {
    if (additional[status]) {
      incrementStatistic(statistic, status, additional[status]);
    }
  });
};
