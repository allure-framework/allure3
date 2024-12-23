import type { TreeFiltersState } from "@/stores/tree";
import type { AllureAwesomeRecursiveTree, AllureAwesomeTree, AllureAwesomeTreeGroup } from "../../types";

const statusOrder = {
  failed: 1,
  broken: 2,
  passed: 3,
  skipped: 4,
  unknown: 5,
};

export const filterLeaves = (
  leaves: string[] = [],
  leavesById: AllureAwesomeTree["leavesById"],
  filterOptions?: TreeFiltersState,
) => {
  const filteredLeaves = [...leaves]
    .map((leafId) => leavesById[leafId])
    .filter((leaf) => {
      const queryMatched = !filterOptions?.query || leaf.name.toLowerCase().includes(filterOptions.query.toLowerCase());
      const statusMatched =
        !filterOptions?.status || filterOptions?.status === "total" || leaf.status === filterOptions.status;
      const flakyMatched = !filterOptions?.filter?.flaky || leaf.flaky;
      const retryMatched = !filterOptions?.filter?.retry || leaf.retry;
      // TODO: at this moment we don't have a new field implementation even in the generator
      // const newMatched = !filterOptions?.filter?.new || leaf.new;

      return [queryMatched, statusMatched, flakyMatched, retryMatched].every(Boolean);
    });

  if (!filterOptions) {
    return filteredLeaves;
  }

  return filteredLeaves.sort((a, b) => {
    const asc = filterOptions.direction === "asc";

    switch (filterOptions.sortBy) {
      case "order":
        return asc ? a.groupOrder - b.groupOrder : b.groupOrder - a.groupOrder;
      case "duration":
        return asc ? (a.duration || 0) - (b.duration || 0) : (b.duration || 0) - (a.duration || 0);
      case "alphabet":
        return asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case "status": {
        const statusA = statusOrder[a.status] || statusOrder.unknown;
        const statusB = statusOrder[b.status] || statusOrder.unknown;

        return asc ? statusA - statusB : statusB - statusA;
      }
      default:
        return 0;
    }
  });
};

/**
 * Fills the given tree from generator and returns recursive tree which includes leaves data instead of their IDs
 * Filters leaves when `filterOptions` property is provided
 * @param payload
 */
export const createRecursiveTree = (payload: {
  group: AllureAwesomeTreeGroup;
  groupsById: AllureAwesomeTree["groupsById"];
  leavesById: AllureAwesomeTree["leavesById"];
  filterOptions?: TreeFiltersState;
}): AllureAwesomeRecursiveTree => {
  const { group, groupsById, leavesById, filterOptions } = payload;
  const groupLeaves = group.leaves ?? [];

  return {
    ...group,
    // FIXME: don't have any idea, why eslint marks next line as unsafe because it actually has a correct type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    leaves: filterLeaves(groupLeaves, leavesById, filterOptions),
    trees: group?.groups
      ?.filter((groupId) => {
        const subGroup = groupsById[groupId];

        return subGroup?.leaves?.length || subGroup?.groups?.length;
      })
      ?.map((groupId) =>
        createRecursiveTree({
          group: groupsById[groupId],
          groupsById,
          leavesById,
          filterOptions,
        }),
      ),
  };
};

export const isRecursiveTreeEmpty = (tree: AllureAwesomeRecursiveTree) => {
  if (!tree.trees?.length && !tree.leaves?.length) {
    return true;
  }

  if (tree.leaves?.length) {
    return false;
  }

  return tree.trees?.every((subTree) => isRecursiveTreeEmpty(subTree));
};
