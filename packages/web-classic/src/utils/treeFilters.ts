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

export const filterNodes = (nodes: any[] = [], filterOptions?: TreeFiltersState) => {
  return nodes
    .filter((node) => {
      const queryMatched =
        !filterOptions?.query || node.name?.toLowerCase().includes(filterOptions.query.toLowerCase());
      const statusMatched =
        !filterOptions?.status || filterOptions?.status === "total" || node.status === filterOptions.status;
      const flakyMatched = !filterOptions?.filter?.flaky || node.flaky;
      const retryMatched = !filterOptions?.filter?.retry || node.retry;

      return [queryMatched, statusMatched, flakyMatched, retryMatched].every(Boolean);
    })
    .sort((a, b) => {
      const asc = filterOptions?.direction === "asc";

      switch (filterOptions?.sortBy) {
        case "order":
          return asc ? (a.groupOrder || 0) - (b.groupOrder || 0) : (b.groupOrder || 0) - (a.groupOrder || 0);
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
export const createRecursiveTree = ({
  node,
  filterOptions,
}: {
  node: AllureAwesomeTreeGroup;
  filterOptions?: TreeFiltersState;
}): any => {
  if (!node) {
    return null;
  }

  const filteredChildren =
    node.children
      ?.map((child: any) => createRecursiveTree({ node: child, filterOptions }))
      ?.filter((child: any) => child !== null) || [];

  return {
    ...node,
    uid: node.uid,
    parentUid: node.parentUid,
    name: node.name,
    children: filterNodes(filteredChildren, filterOptions),
  };
};

export const isRecursiveTreeEmpty = (tree: AllureAwesomeRecursiveTree): boolean => {
  if (!tree.children?.length) {
    return true;
  }

  if (tree.children?.length) {
    return false;
  }

  return tree.children?.every((subTree) => isRecursiveTreeEmpty(subTree));
};
