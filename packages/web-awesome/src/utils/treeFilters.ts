import type { Comparator, Statistic, TestStatus, TreeLeaf } from "@allurereport/core-api";
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

import type { SortBy } from "@/stores/treeSort";

import type { AwesomeRecursiveTree, AwesomeTree, AwesomeTreeGroup, AwesomeTreeLeaf } from "../../types";

const leafComparatorByTreeSortBy = (sortBy: SortBy = "status,asc"): Comparator<TreeLeaf<AwesomeTreeLeaf>> => {
  const typedCompareBy = compareBy<TreeLeaf<AwesomeTreeLeaf>>;
  switch (sortBy) {
    case "order,asc":
    case "order,desc":
      return typedCompareBy("groupOrder", ordinal());
    case "duration,asc":
    case "duration,desc":
      return typedCompareBy("duration", ordinal());
    case "name,asc":
    case "name,desc":
      return typedCompareBy("name", alphabetically());
    case "status,asc":
    case "status,desc":
      return typedCompareBy("status", byStatus());
    default:
      // eslint-disable-next-line no-console
      console.warn(`unsupported comparator ${sortBy as string}`);
      return () => 0;
  }
};

const groupComparatorByTreeSortBy = (sortBy: SortBy = "status,asc"): Comparator<AwesomeRecursiveTree> => {
  const typedCompareBy = compareBy<AwesomeRecursiveTree>;
  switch (sortBy) {
    case "name,desc":
    case "name,asc":
      return typedCompareBy("name", alphabetically());
    case "order,desc":
    case "order,asc":
      return typedCompareBy("groupOrder", ordinal());
    case "duration,desc":
    case "duration,asc":
      return typedCompareBy("duration", ordinal());
    case "status,desc":
    case "status,asc":
      return typedCompareBy("statistic", byStatistic());
    default:
      // eslint-disable-next-line no-console
      console.warn(`unsupported comparator ${sortBy as string}`);
      return () => 0;
  }
};

const withDirection = <T extends { name: string }>(cmp: Comparator<T>, sortBy: SortBy): Comparator<T> => {
  const sortParams = sortBy.split(",");
  const isStatusSort = sortParams.includes("status");
  const isDescending = sortParams.includes("desc");
  const nameComparator = compareBy<T>("name", alphabetically());

  return andThen([
    isDescending && !isStatusSort ? reverse(cmp) : cmp,
    isDescending && isStatusSort ? reverse(nameComparator) : nameComparator,
  ]);
};

export const leafComparator = (sortBy: SortBy = "status,asc"): Comparator<TreeLeaf<AwesomeTreeLeaf>> => {
  const cmp = leafComparatorByTreeSortBy(sortBy);

  return withDirection(cmp, sortBy);
};

export const groupComparator = (sortBy: SortBy = "status,asc"): Comparator<AwesomeRecursiveTree> => {
  const cmp = groupComparatorByTreeSortBy(sortBy);

  return withDirection(cmp, sortBy);
};

export const filterLeaves = (
  leafIds: string[] = [],
  leavesById: AwesomeTree["leavesById"],
  filterPredicate: (item: AwesomeTreeLeaf) => boolean,
  sortBy: SortBy = "status,asc",
) => {
  let leaves = [...leafIds].map((leafId) => leavesById[leafId]);

  if (filterPredicate) {
    leaves = leaves.filter(filterPredicate);
  }

  const comparator = leafComparator(sortBy);
  return leaves.sort(comparator);
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
  filterPredicate: (item: AwesomeTreeLeaf) => boolean;
  sortBy: SortBy;
}): AwesomeRecursiveTree => {
  const { group, groupsById, leavesById, filterPredicate, sortBy } = payload;
  const groupLeaves: string[] = group.leaves ?? [];

  const leaves = filterLeaves(groupLeaves, leavesById, filterPredicate, sortBy);

  const trees =
    group.groups
      ?.flatMap((groupId) => {
        const nestedGroup = groupsById[groupId];
        if (!nestedGroup) {
          return [];
        }

        return [
          createRecursiveTree({
            group: nestedGroup,
            groupsById,
            leavesById,
            filterPredicate,
            sortBy,
          }),
        ];
      })
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

  const duration =
    leaves.reduce((acc, leaf) => acc + (leaf.duration ?? 0), 0) + trees.reduce((acc, rt) => acc + rt.duration, 0);

  const leafMinOrder = leaves.reduce((acc, leaf) => Math.min(acc, leaf.groupOrder ?? Infinity), Infinity);
  const treeMinOrder = trees.reduce((acc, rt) => Math.min(acc, rt.groupOrder), Infinity);
  const groupOrder = Math.min(leafMinOrder, treeMinOrder);

  return {
    ...group,
    statistic,
    leaves,
    trees: trees.sort(groupComparator(sortBy)),
    duration,
    groupOrder: isFinite(groupOrder) ? groupOrder : 0,
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
