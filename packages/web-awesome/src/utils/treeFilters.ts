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

const groupComparatorByTreeSortBy = (sortBy: SortBy = "status,asc"): Comparator<DefaultTreeGroup> => {
  const typedCompareBy = compareBy<DefaultTreeGroup>;
  switch (sortBy) {
    case "name,desc":
    case "name,asc":
      return typedCompareBy("name", alphabetically());
    case "order,desc":
    case "order,asc":
    case "duration,desc":
    case "duration,asc":
    case "status,desc":
    case "status,asc":
      return typedCompareBy("statistic", byStatistic());
    default:
      // eslint-disable-next-line no-console
      console.warn(`unsupported comparator ${sortBy as string}`);
      return () => 0;
  }
};

export const leafComparator = (sortBy: SortBy = "status,asc"): Comparator<TreeLeaf<AwesomeTreeLeaf>> => {
  const cmp = leafComparatorByTreeSortBy(sortBy);
  const directional = sortBy.split(",")[1] === "asc" ? cmp : reverse(cmp);
  // apply fallback sorting by name
  return andThen([directional, compareBy("name", alphabetically())]);
};

export const groupComparator = (sortBy: SortBy = "status,asc"): Comparator<DefaultTreeGroup> => {
  const cmp = groupComparatorByTreeSortBy(sortBy);
  const directional = sortBy.split(",")[1] === "asc" ? cmp : reverse(cmp);
  // apply fallback sorting by name
  return andThen([directional, compareBy("name", alphabetically())]);
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
      ?.map((groupId) =>
        createRecursiveTree({
          group: groupsById[groupId],
          groupsById,
          leavesById,
          filterPredicate,
          sortBy,
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
    trees: trees.sort(groupComparator(sortBy)),
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
