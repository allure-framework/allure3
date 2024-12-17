import type { TreeFiltersState } from "@/stores/tree";
import type {
  AllureAwesomeOrderedTree,
  AllureAwesomeTree,
  AllureAwesomeTreeGroup,
  AllureAwesomeTreeLeaf,
} from "../../types";

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
      const retryMatched = !filterOptions?.filter?.retry || leaf?.retries?.length > 0;
      // TODO: at this moment we don't have a new field implementation even in the generator
      // const newMatched = !filterOptions?.filter?.new || leaf.new;

      return [queryMatched, statusMatched, flakyMatched, retryMatched].every(Boolean);
    })
    .sort((a, b) => a.start - b.start)
    .map(
      (leaf, i) =>
        ({
          ...leaf,
          groupOrder: i + 1,
        }) as AllureAwesomeTreeLeaf,
    );

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

export const fillTree = (payload: {
  group: AllureAwesomeTreeGroup;
  groupsById: AllureAwesomeTree["groupsById"];
  leavesById: AllureAwesomeTree["leavesById"];
  filterOptions?: TreeFiltersState;
}): AllureAwesomeOrderedTree => {
  const { group, groupsById, leavesById, filterOptions } = payload;

  return {
    ...group,
    leaves: filterLeaves(group.leaves, leavesById, filterOptions),
    groups: group?.groups?.map((groupId) =>
      fillTree({
        group: groupsById[groupId],
        groupsById,
        leavesById,
        filterOptions,
      }),
    ),
  };
};
