import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";
import { fillTree, filterGroups, filterLeaves } from "@/utils/treeFilters";

export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new";
export type TreeFiltersState = {
  query: string;
  // TODO: use normal status type here
  status: string;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};

export const treeStore = signal<StoreSignalState<any>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const treeFiltersStore = signal<TreeFiltersState>({
  query: "",
  status: "total",
  filter: {
    flaky: false,
    retry: false,
    new: false,
  },
  sortBy: "alphabet",
  direction: "asc",
});

export const setTreeQuery = (query: string) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    query,
  };
};

export const setTreeStatus = (status: string) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    status,
  };
};

export const setTreeSortBy = (sortBy: TreeSortBy) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    sortBy,
  };
};

export const setTreeDirection = (direction: TreeDirection) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    direction,
  };
}

export const setTreeFilter = (filterKey: TreeFilters, value: boolean) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    filter: {
      ...treeFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

// const leavesToRender = filterLeaves(leaves, treeData?.leavesById, statusFilter, reportContext);
// const groupsToRender = filterGroups(
//     groups,
//     treeData?.groupsById,
//     treeData?.leavesById,
//     statusFilter,
//     reportContext,
// );

export const filteredTree = computed(() => {
  const { root, leavesById, groupsById } = treeStore.value.data;

  return fillTree({
    group: root,
    leavesById,
    groupsById,
    filterOptions: treeFiltersStore.value,
  });
});

export const fetchTreeData = async (treeName: string) => {
  treeStore.value = {
    ...treeStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData(`widgets/${treeName}.json`);

    treeStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    treeStore.value = {
      ...treeStore.value,
      error: e.message,
      loading: false,
    };
  }
};
