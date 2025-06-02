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

export const packagesStore = signal<StoreSignalState<AwesomeTree>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() => !Object.keys(packagesStore?.value?.data?.leavesById).length);

export const packagesFiltersStore = signal<TreeFiltersState>({
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

export const filteredPackages = computed(() => {
  const { root, leavesById, groupsById } = packagesStore.value.data;

  return createRecursiveTree({
    group: root as AwesomeTreeGroup,
    leavesById,
    groupsById,
    filterOptions: packagesFiltersStore.value,
  });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredPackages.value);
});

export const clearPackagesFilters = () => {
  packagesFiltersStore.value = {
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

export const setPackagesQuery = (query: string) => {
  packagesFiltersStore.value = {
    ...packagesFiltersStore.value,
    query,
  };
};

export const setPackagesStatus = (status: AwesomeStatus) => {
  packagesFiltersStore.value = {
    ...packagesFiltersStore.value,
    status,
  };
};

export const setPackagesSortBy = (sortBy: TreeSortBy) => {
  packagesFiltersStore.value = {
    ...packagesFiltersStore.value,
    sortBy,
  };
};

export const setPackagesDirection = (direction: TreeDirection) => {
  packagesFiltersStore.value = {
    ...packagesFiltersStore.value,
    direction,
  };
};

export const setPackagesFilter = (filterKey: TreeFilters, value: boolean) => {
  packagesFiltersStore.value = {
    ...packagesFiltersStore.value,
    filter: {
      ...packagesFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

export const fetchPackagesData = async () => {
  packagesStore.value = {
    ...packagesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AwesomeTree>("widgets/packages.json", { bustCache: true });

    packagesStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    packagesStore.value = {
      ...packagesStore.value,
      error: e.message,
      loading: false,
    };
  }
};
