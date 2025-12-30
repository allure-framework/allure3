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
import type { ClassicRecursiveTree, ClassicTree, ClassicTreeGroup, ClassicTreeLeaf } from "../../types";

export const isIncluded = (leaf: TreeLeaf<ClassicTreeLeaf>, filterOptions: TreeFiltersState) => {
  const queryMatched = !filterOptions?.query || leaf.name.toLowerCase().includes(filterOptions.query.toLowerCase());
  const statusMatched =
    !filterOptions?.status || filterOptions?.status === "total" || leaf.status === filterOptions.status;
  const flakyMatched = !filterOptions?.filter?.flaky || leaf.flaky;
  const retryMatched = !filterOptions?.filter?.retry || leaf.retry;
  // TODO: at this moment we don't have a new field implementation even in the generator
  // const newMatched = !filterOptions?.filter?.new || leaf.new;

  return [queryMatched, statusMatched, flakyMatched, retryMatched].every(Boolean);
};

const leafComparatorByTreeSortBy = (sortBy: TreeSortBy): Comparator<TreeLeaf<ClassicTreeLeaf>> => {
  const typedCompareBy = compareBy<TreeLeaf<ClassicTreeLeaf>>;
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

export const leafComparator = (filterOptions: TreeFiltersState): Comparator<TreeLeaf<ClassicTreeLeaf>> => {
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
  leavesById: ClassicTree["leavesById"],
  filterOptions: TreeFiltersState,
) => {
  const filteredLeaves = [...leaves]
    .map((leafId) => leavesById[leafId])
    .filter((leaf: TreeLeaf<ClassicTreeLeaf>) => isIncluded(leaf, filterOptions));

  const comparator = leafComparator(filterOptions);
  return filteredLeaves.sort(comparator);
};

/**
 * Fills the given tree from generator and returns recursive tree which includes leaves data instead of their IDs
 * Filters leaves when `filterOptions` property is provided
 * @param payload
 */
export const createRecursiveTree = (payload: {
  group: ClassicTreeGroup;
  groupsById: ClassicTree["groupsById"];
  leavesById: ClassicTree["leavesById"];
  filterOptions?: TreeFiltersState;
}): ClassicRecursiveTree => {
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
  trees.forEach((rt: ClassicRecursiveTree) => {
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

export const isRecursiveTreeEmpty = (tree: ClassicRecursiveTree): boolean => {
  if (!tree.trees?.length && !tree.leaves?.length) {
    return true;
  }

  if (tree.leaves?.length) {
    return false;
  }

  return tree.trees?.every((subTree) => isRecursiveTreeEmpty(subTree));
};
