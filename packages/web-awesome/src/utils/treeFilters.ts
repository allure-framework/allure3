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

import type { ReportRecursiveTree, ReportTree, ReportTreeGroup, ReportTreeLeaf } from "../../types";

type ComputedRecursiveTree = ReportRecursiveTree & {
  duration: number;
  groupOrder: number;
  trees: ComputedRecursiveTree[];
};

const leafComparatorByTreeSortBy = (sortBy: SortBy = "status,asc"): Comparator<TreeLeaf<ReportTreeLeaf>> => {
  switch (sortBy) {
    case "order,asc":
    case "order,desc":
      return compareBy<TreeLeaf<ReportTreeLeaf>, "groupOrder">("groupOrder", ordinal());
    case "duration,asc":
    case "duration,desc":
      return compareBy<TreeLeaf<ReportTreeLeaf>, "duration">("duration", ordinal());
    case "name,asc":
    case "name,desc":
      return compareBy<TreeLeaf<ReportTreeLeaf>, "name">("name", alphabetically());
    case "status,asc":
    case "status,desc":
      return compareBy<TreeLeaf<ReportTreeLeaf>, "status">("status", byStatus());
    default:
      // eslint-disable-next-line no-console
      console.warn(`unsupported comparator ${sortBy as string}`);
      return () => 0;
  }
};

const groupComparatorByTreeSortBy = (sortBy: SortBy = "status,asc"): Comparator<ReportRecursiveTree> => {
  switch (sortBy) {
    case "name,desc":
    case "name,asc":
      return compareBy<ReportRecursiveTree, "name">("name", alphabetically());
    case "order,desc":
    case "order,asc":
      return andThen([
        compareBy<ReportRecursiveTree, "groupOrder">("groupOrder", ordinal()),
        compareBy<ReportRecursiveTree, "minStart">("minStart", ordinal()),
      ]);
    case "duration,desc":
    case "duration,asc":
      return compareBy<ReportRecursiveTree, "duration">("duration", ordinal());
    case "status,desc":
    case "status,asc":
      return compareBy<ReportRecursiveTree, "statistic">("statistic", byStatistic());
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
  const nameComparator = compareBy<T, "name">("name", alphabetically());

  return andThen([
    isDescending && !isStatusSort ? reverse(cmp) : cmp,
    isDescending && isStatusSort ? reverse(nameComparator) : nameComparator,
  ]);
};

export const leafComparator = (sortBy: SortBy = "status,asc"): Comparator<TreeLeaf<ReportTreeLeaf>> => {
  const cmp = leafComparatorByTreeSortBy(sortBy);

  return withDirection(cmp, sortBy);
};

export const groupComparator = (sortBy: SortBy = "status,asc"): Comparator<ReportRecursiveTree> => {
  const cmp = groupComparatorByTreeSortBy(sortBy);

  return withDirection(cmp, sortBy);
};

export const filterLeaves = (
  leafIds: string[] = [],
  leavesById: ReportTree["leavesById"],
  filterPredicate: (item: ReportTreeLeaf) => boolean,
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
  group: ReportTreeGroup;
  groupsById: ReportTree["groupsById"];
  leavesById: ReportTree["leavesById"];
  filterPredicate: (item: ReportTreeLeaf) => boolean;
  sortBy: SortBy;
}): ComputedRecursiveTree => {
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

  const duration =
    leaves.reduce((acc, leaf) => acc + (leaf.duration ?? 0), 0) + trees.reduce((acc, rt) => acc + rt.duration, 0);

  const leafMinOrder = leaves.reduce((acc, leaf) => Math.min(acc, leaf.groupOrder ?? Infinity), Infinity);
  const treeMinOrder = trees.reduce((acc, rt) => Math.min(acc, rt.groupOrder), Infinity);
  const groupOrder = Math.min(leafMinOrder, treeMinOrder);
  const leafMinStart = leaves.reduce((acc, leaf) => Math.min(acc, leaf.start ?? Infinity), Infinity);
  const treeMinStart = trees.reduce((acc, rt) => Math.min(acc, rt.minStart ?? Infinity), Infinity);
  const minStart = Math.min(leafMinStart, treeMinStart);

  return {
    ...group,
    statistic,
    leaves,
    trees: trees.sort(groupComparator(sortBy)),
    duration,
    groupOrder: isFinite(groupOrder) ? groupOrder : 0,
    minStart: isFinite(minStart) ? minStart : undefined,
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
