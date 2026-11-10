import { statusesList, type Statistic, type TestStatus } from "@allurereport/core-api";
import type { ReportTree } from "types";

const failureStatuses = new Set<TestStatus>(["failed", "broken"]);

const getRawStatusCounts = (stats: Statistic): Partial<Record<TestStatus, number>> =>
  statusesList.reduce<Partial<Record<TestStatus, number>>>((acc, status) => {
    acc[status] = stats[status];
    return acc;
  }, {});

export const getUnresolvedStatusCounts = (
  stats: Statistic,
  trees: Record<string, ReportTree> | undefined,
  environmentId?: string,
): Partial<Record<TestStatus, number>> => {
  if (!trees) {
    return getRawStatusCounts(stats);
  }

  // Every status gets an explicit count, so a status whose results are all resolved reads as 0
  // instead of being absent and making callers fall back to the raw stats.
  const counts: Partial<Record<TestStatus, number>> = Object.fromEntries(statusesList.map((status) => [status, 0]));
  const envIds = environmentId ? [environmentId] : Object.keys(trees);

  if (envIds.some((envId) => !trees[envId])) {
    return getRawStatusCounts(stats);
  }

  for (const envId of envIds) {
    for (const leaf of Object.values(trees[envId]?.leavesById ?? {})) {
      if (failureStatuses.has(leaf.status) && leaf.resolutionStatus !== "none" && leaf.resolutionState !== "outdated") {
        continue;
      }

      counts[leaf.status] = (counts[leaf.status] ?? 0) + 1;
    }
  }

  return counts;
};
