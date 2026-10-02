import {
  statusesList,
  type DefaultTreeGroup,
  type DefaultTreeLeaf,
  type Statistic,
  type TestStatus,
  type TreeData,
} from "@allurereport/core-api";
import type { ReportTree } from "types";

export type Stats = Record<TestStatus, number> & { total?: number };

const emptyStat: Stats = { failed: 0, broken: 0, passed: 0, skipped: 0, unknown: 0 };

const statisticByIds = (tree: TreeData<DefaultTreeLeaf, DefaultTreeGroup>, ids: string[]): Stats => {
  return ids
    .map((id) => tree.leavesById[id])
    .filter((v) => v)
    .reduce(
      (prev, current) => {
        prev[current.status]++;
        return prev;
      },
      { ...emptyStat },
    );
};

const mergeStats = (stat1: Stats, stat2: Stats): Stats => {
  Object.keys(stat1).forEach((key) => {
    stat1[key as TestStatus] += stat2[key as TestStatus];
  });
  return stat1;
};

export const getGroupStatistics = (
  tree: TreeData<DefaultTreeLeaf, DefaultTreeGroup>,
  groupId: string,
  statusFilter?: string,
): Stats => {
  const group = tree.groupsById[groupId];
  let stat: Stats = { ...emptyStat };

  if (group?.leaves?.length) {
    stat = mergeStats(stat, statisticByIds(tree, group.leaves));
  }

  if (group?.groups?.length) {
    for (const subGroupId of group.groups) {
      const subGroupStat = getGroupStatistics(tree, subGroupId, statusFilter);
      stat = mergeStats(stat, subGroupStat);
    }
  }

  return stat;
};

export const getStatistics = (tree: TreeData<DefaultTreeLeaf, DefaultTreeGroup>) =>
  tree.root.groups
    ?.map((groupId) => {
      const stat = getGroupStatistics(tree, groupId);
      return { name: tree.groupsById[groupId].name, statistic: stat };
    })
    ?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];

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

  const counts: Partial<Record<TestStatus, number>> = {};
  const envIds = environmentId ? [environmentId] : Object.keys(trees);

  if (envIds.some((envId) => !trees[envId])) {
    return getRawStatusCounts(stats);
  }

  for (const envId of envIds) {
    for (const leaf of Object.values(trees[envId]?.leavesById ?? {})) {
      if (failureStatuses.has(leaf.status) && leaf.resolutionStatus !== "none") {
        continue;
      }

      counts[leaf.status] = (counts[leaf.status] ?? 0) + 1;
    }
  }

  return counts;
};
