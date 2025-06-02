import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AwesomeStatus, AwesomeTree, AwesomeTreeGroup } from "types";
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

export const noTests = computed(() => !Object.keys(categoriesStore?.value?.data?.leavesById).length);

export const categoriesFiltersStore = signal<TreeFiltersState>({
  query: "",
  status: "total",
  filter: {
    flaky: false,
    retry: false,
    new: false,
  },
  sortBy: "order",
  direction: "asc",
});

export const filteredCategories = computed(() => {
  const { root, leavesById, groupsById } = categoriesStore.value.data;

  return createRecursiveTree({
    group: root as AwesomeTreeGroup,
    leavesById,
    groupsById,
    filterOptions: categoriesFiltersStore.value,
  });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredCategories.value);
});

export const clearCategoriesFilters = () => {
  categoriesFiltersStore.value = {
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
  categoriesFiltersStore.value = {
    ...categoriesFiltersStore.value,
    query,
  };
};

export const setCategoriesStatus = (status: AwesomeStatus) => {
  categoriesFiltersStore.value = {
    ...categoriesFiltersStore.value,
    status,
  };
};

export const setCategoriesSortBy = (sortBy: TreeSortBy) => {
  categoriesFiltersStore.value = {
    ...categoriesFiltersStore.value,
    sortBy,
  };
};

export const setCategoriesDirection = (direction: TreeDirection) => {
  categoriesFiltersStore.value = {
    ...categoriesFiltersStore.value,
    direction,
  };
};

export const setCategoriesFilter = (filterKey: TreeFilters, value: boolean) => {
  categoriesFiltersStore.value = {
    ...categoriesFiltersStore.value,
    filter: {
      ...categoriesFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

export const fetchCategoriesData = async () => {
  categoriesStore.value = {
    ...categoriesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AwesomeTree>("widgets/categories.json", { bustCache: true });

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
