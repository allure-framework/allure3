import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";
import type { AwesomeStatus, AwesomeTree, AwesomeTreeGroup } from "types";
import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";
import { createRecursiveTree, isRecursiveTreeEmpty } from "@/utils/treeFilters";

export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new";
export type TreeFiltersState = {
  query: string;
  status: AwesomeStatus;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};

export const treeStore = signal<StoreSignalState<AwesomeTree>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() => !Object.keys(treeStore?.value?.data?.leavesById).length);

const loadedFromLS = loadFromLocalStorage<string[]>("collapsedTrees", []);
export const collapsedTrees = signal(new Set(loadedFromLS as string[]));

effect(() => {
  localStorage.setItem("collapsedTrees", JSON.stringify([...collapsedTrees.value]));
});

export const toggleTree = (id: string) => {
  const newSet = new Set(collapsedTrees.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  collapsedTrees.value = newSet;
};

export const selectedFilters = signal(new Set(loadFromLocalStorage("selectedFilters", []) as []));

effect(() => {
  localStorage.setItem("selectedFilters", JSON.stringify([...selectedFilters.value]));
});

export const treeFiltersStore = signal<TreeFiltersState>(
  loadFromLocalStorage<TreeFiltersState>("treeFilters", {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
    },
    sortBy: "order",
    direction: "asc",
  }) as TreeFiltersState,
);

effect(() => {
  localStorage.setItem("treeFilters", JSON.stringify(treeFiltersStore.value));
});

export const filteredTree = computed(() => {
  const { root, leavesById, groupsById } = treeStore.value.data;

  return createRecursiveTree({
    group: root as AwesomeTreeGroup,
    leavesById,
    groupsById,
    filterOptions: treeFiltersStore.value,
  });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredTree.value);
});

export const clearTreeFilters = () => {
  treeFiltersStore.value = {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
    },
    sortBy: "order",
    direction: "asc",
  };
};

export const setTreeQuery = (query: string) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    query,
  };
};

export const setTreeStatus = (status: AwesomeStatus) => {
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
};

export const setTreeFilter = (filterKey: TreeFilters, value: boolean) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    filter: {
      ...treeFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

export const fetchTreeData = async () => {
  treeStore.value = {
    ...treeStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AwesomeTree>("widgets/tree.json");

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
