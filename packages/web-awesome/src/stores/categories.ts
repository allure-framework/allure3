import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AwesomeStatus, AwesomeTree, AwesomeTreeGroup } from "types";
import { treeStore } from "@/stores/tree";
import { treeFiltersStore } from "@/stores/treeFilters";
import type { StoreSignalState } from "@/stores/types";
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

export const categoriesStore = signal<StoreSignalState<AwesomeTree>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() => !Object.keys(categoriesStore?.value?.data?.leavesById || {}).length);

export const filteredCategories = computed(() => {
  const { root, leavesById, groupsById } = categoriesStore.value.data;

  return createRecursiveTree({
    group: root as AwesomeTreeGroup,
    leavesById,
    groupsById,
    filterOptions: treeFiltersStore.value,
  });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredCategories.value);
});

export const clearCategoriesFilters = () => {
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

export const setCategoriesQuery = (query: string) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    query,
  };
};

export const setCategoriesStatus = (status: AwesomeStatus) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    status,
  };
};

export const fetchCategoriesData = async () => {
  categoriesStore.value = {
    ...categoriesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AwesomeTree>("widgets/categories.json");

    categoriesStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    categoriesStore.value = {
      ...categoriesStore.value,
      error: e.message,
      loading: false,
    };
  }
};
