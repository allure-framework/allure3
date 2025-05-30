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
import type { AwesomeRecursiveTree, AwesomeTree, AwesomeTreeGroup, AwesomeTreeLeaf } from "../../types";

export const isIncluded = (leaf: TreeLeaf<AwesomeTreeLeaf>, filterOptions: TreeFiltersState) => {
  const queryMatched = !filterOptions?.query || leaf.name.toLowerCase().includes(filterOptions.query.toLowerCase());
  const statusMatched =
    !filterOptions?.status || filterOptions?.status === "total" || leaf.status === filterOptions.status;
  const flakyMatched = !filterOptions?.filter?.flaky || leaf.flaky;
  const retryMatched = !filterOptions?.filter?.retry || leaf.retry;
  const newMatched = !filterOptions?.filter?.new || leaf.transition === "new";
  const fixedMatched = !filterOptions?.filter?.fixed || leaf.transition === "fixed";
  const regressedMatched = !filterOptions?.filter?.regressed || leaf.transition === "regressed";
  const malfuctionedMatched = !filterOptions?.filter?.malfunctioned || leaf.transition === "malfunctioned";

  return [
    queryMatched,
    statusMatched,
    flakyMatched,
    retryMatched,
    newMatched,
    fixedMatched,
    regressedMatched,
    malfuctionedMatched,
  ].every(Boolean);
};

const leafComparatorByTreeSortBy = (sortBy: TreeSortBy = "status"): Comparator<TreeLeaf<AwesomeTreeLeaf>> => {
  const typedCompareBy = compareBy<TreeLeaf<AwesomeTreeLeaf>>;
  switch (sortBy) {
    case "order":
      return typedCompareBy("groupOrder", ordinal());
    case "duration":
      return typedCompareBy("duration", ordinal());
    case "alphabet":
      return typedCompareBy("name", alphabetically());
    case "status":
      return typedCompareBy("status", byStatus());
    default:
      // eslint-disable-next-line no-console
      console.error(`unsupported comparator ${sortBy}`);
      return () => 0;
  }
};

const groupComparatorByTreeSortBy = (sortBy: TreeSortBy = "status"): Comparator<DefaultTreeGroup> => {
  const typedCompareBy = compareBy<DefaultTreeGroup>;
  switch (sortBy) {
    case "alphabet":
      return typedCompareBy("name", alphabetically());
    case "order":
    case "duration":
    case "status":
      return typedCompareBy("statistic", byStatistic());
    default:
      // eslint-disable-next-line no-console
      console.error(`unsupported comparator ${sortBy}`);
      return () => 0;
  }
};

export const leafComparator = (filterOptions: TreeFiltersState): Comparator<TreeLeaf<AwesomeTreeLeaf>> => {
  const cmp = leafComparatorByTreeSortBy(filterOptions.sortBy);
  const directional = filterOptions.direction === "asc" ? cmp : reverse(cmp);
  // apply fallback sorting by name
  return andThen([directional, compareBy("name", alphabetically())]);
};

export const groupComparator = (filterOptions: TreeFiltersState): Comparator<DefaultTreeGroup> => {
  const cmp = groupComparatorByTreeSortBy(filterOptions.sortBy);
  const directional = filterOptions.direction === "asc" ? cmp : reverse(cmp);
  // apply fallback sorting by name
  return andThen([directional, compareBy("name", alphabetically())]);
};

export const filterLeaves = (
  leaves: string[] = [],
  leavesById: AwesomeTree["leavesById"],
  filterOptions: TreeFiltersState,
) => {
  const filteredLeaves = [...leaves]
    .map((leafId) => leavesById[leafId])
    .filter((leaf: TreeLeaf<AwesomeTreeLeaf>) => isIncluded(leaf, filterOptions));

  const comparator = leafComparator(filterOptions);
  return filteredLeaves.sort(comparator);
};

/**
 * Fills the given tree from generator and returns recursive tree which includes leaves data instead of their IDs
 * Filters leaves when `filterOptions` property is provided
 * @param payload
 */
export const createRecursiveTree = (payload: {
  group: AwesomeTreeGroup;
  groupsById: AwesomeTree["groupsById"];
  leavesById: AwesomeTree["leavesById"];
  filterOptions?: TreeFiltersState;
}): AwesomeRecursiveTree => {
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
  trees.forEach((rt: AwesomeRecursiveTree) => {
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

export const isRecursiveTreeEmpty = (tree: AwesomeRecursiveTree): boolean => {
  if (!tree.trees?.length && !tree.leaves?.length) {
    return true;
  }

  if (tree.leaves?.length) {
    return false;
  }

  return tree.trees?.every((subTree) => isRecursiveTreeEmpty(subTree));
};
