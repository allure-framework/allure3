import type { Comparator, DefaultTreeGroup, Statistic, TestStatus, TreeLeaf } from "@allurereport/core-api";
import {
  alphabetically,
  andThen,
  byStatistic,
  byStatus,
  compareBy,
  emptyStatistic,
  incrementStatistic,
  mergeStatistic,
  ordinal,
  reverse,
} from "@allurereport/core-api";

import type { TreeFiltersState, TreeSortBy } from "@/stores/tree";

import type { ReportRecursiveTree, ReportTree, ReportTreeGroup, ReportTreeLeaf } from "../../types";

export const isIncluded = (leaf: TreeLeaf<ReportTreeLeaf>, filterOptions: TreeFiltersState) => {
  const queryMatched = !filterOptions?.query || leaf.name.toLowerCase().includes(filterOptions.query.toLowerCase());
  const statusMatched =
    !filterOptions?.status || filterOptions?.status === "total" || leaf.status === filterOptions.status;
  const flakyMatched = !filterOptions?.filter?.flaky || leaf.flaky;
  const retryMatched = !filterOptions?.filter?.retry || leaf.retry;
  // TODO: at this moment we don't have a new field implementation even in the generator
  // const newMatched = !filterOptions?.filter?.new || leaf.new;

  return [queryMatched, statusMatched, flakyMatched, retryMatched].every(Boolean);
};

const leafComparatorByTreeSortBy = (sortBy: TreeSortBy): Comparator<TreeLeaf<ReportTreeLeaf>> => {
  const typedCompareBy = compareBy<TreeLeaf<ReportTreeLeaf>>;
  switch (sortBy) {
    case "order":
      return typedCompareBy("groupOrder", ordinal());
    case "duration":
      return typedCompareBy("duration", ordinal());
    case "alphabet":
      return typedCompareBy("name", alphabetically());
    case "status":
      return typedCompareBy("status", byStatus());
  }
};

const groupComparatorByTreeSortBy = (sortBy: TreeSortBy): Comparator<DefaultTreeGroup> => {
  const typedCompareBy = compareBy<DefaultTreeGroup>;
  switch (sortBy) {
    case "alphabet":
      return typedCompareBy("name", alphabetically());
    case "order":
    case "duration":
    case "status":
      return typedCompareBy("statistic", byStatistic());
  }
};

const withDirection = <T extends { name: string }>(
  cmp: Comparator<T>,
  filterOptions: TreeFiltersState,
): Comparator<T> => {
  const isStatusSort = filterOptions.sortBy === "status";
  const isDescending = filterOptions.direction === "desc";
  const nameComparator = compareBy<T>("name", alphabetically());

  // Status sort always prioritizes severity. Direction only affects name-based tie-breaking.
  return andThen([
    isDescending && !isStatusSort ? reverse(cmp) : cmp,
    isDescending && isStatusSort ? reverse(nameComparator) : nameComparator,
  ]);
};

export const leafComparator = (filterOptions: TreeFiltersState): Comparator<TreeLeaf<ReportTreeLeaf>> => {
  const cmp = leafComparatorByTreeSortBy(filterOptions.sortBy);

  return withDirection(cmp, filterOptions);
};

export const groupComparator = (filterOptions: TreeFiltersState): Comparator<DefaultTreeGroup> => {
  const cmp = groupComparatorByTreeSortBy(filterOptions.sortBy);

  return withDirection(cmp, filterOptions);
};

export const filterLeaves = (
  leaves: string[] = [],
  leavesById: ReportTree["leavesById"],
  filterOptions: TreeFiltersState,
) => {
  const filteredLeaves = [...leaves]
    .map((leafId) => leavesById[leafId])
    .filter((leaf: TreeLeaf<ReportTreeLeaf>) => isIncluded(leaf, filterOptions));

  const comparator = leafComparator(filterOptions);
  return filteredLeaves.sort(comparator);
};

/**
 * Fills the given tree from generator and returns recursive tree which includes leaves data instead of their IDs
 * Filters leaves when `filterOptions` property is provided
 * @param payload
 */
export const createRecursiveTree = (payload: {
  group: ReportTreeGroup;
  groupsById: ReportTree["groupsById"];
  leavesById: ReportTree["leavesById"];
  filterOptions?: TreeFiltersState;
}): ReportRecursiveTree => {
  const { group, groupsById, leavesById, filterOptions } = payload;
  const groupLeaves: string[] = group.leaves ?? [];

  const leaves = filterLeaves(groupLeaves, leavesById, filterOptions);
  const trees =
    group.groups
      ?.map((groupId) =>
        createRecursiveTree({
          group: groupsById[groupId],
          groupsById,
          leavesById,
          filterOptions,
        }),
      )
      ?.filter((rt) => !isRecursiveTreeEmpty(rt)) ?? [];

  const statistic: Statistic = emptyStatistic();
  trees.forEach((rt: ReportRecursiveTree) => {
    if (rt.statistic) {
      const additional: Statistic = rt.statistic;

      mergeStatistic(statistic, additional);
    }
  });
  leaves.forEach((leaf) => {
    const status: TestStatus = leaf.status;
    incrementStatistic(statistic, status);
  });

  return {
    ...group,
    statistic,
    leaves,
    trees: trees.sort(groupComparator(filterOptions)),
  };
};

export const isRecursiveTreeEmpty = (tree: ReportRecursiveTree): boolean => {
  if (!tree.trees?.length && !tree.leaves?.length) {
    return true;
  }

  if (tree.leaves?.length) {
    return false;
  }

  return tree.trees?.every((subTree) => isRecursiveTreeEmpty(subTree));
};
