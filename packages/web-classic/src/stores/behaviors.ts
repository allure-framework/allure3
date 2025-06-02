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

export const behaviorsStore = signal<StoreSignalState<AwesomeTree>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() => !Object.keys(behaviorsStore?.value?.data?.leavesById).length);

export const behaviorsFiltersStore = signal<TreeFiltersState>({
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

export const filteredBehaviors = computed(() => {
  const { root, leavesById, groupsById } = behaviorsStore.value.data;

  return createRecursiveTree({
    group: root as AwesomeTreeGroup,
    leavesById,
    groupsById,
    filterOptions: behaviorsFiltersStore.value,
  });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredBehaviors.value);
});

export const clearBehaviorsFilters = () => {
  behaviorsFiltersStore.value = {
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

export const setBehaviorsQuery = (query: string) => {
  behaviorsFiltersStore.value = {
    ...behaviorsFiltersStore.value,
    query,
  };
};

export const setBehaviorsStatus = (status: AwesomeStatus) => {
  behaviorsFiltersStore.value = {
    ...behaviorsFiltersStore.value,
    status,
  };
};

export const setBehaviorsSortBy = (sortBy: TreeSortBy) => {
  behaviorsFiltersStore.value = {
    ...behaviorsFiltersStore.value,
    sortBy,
  };
};

export const setBehaviorsDirection = (direction: TreeDirection) => {
  behaviorsFiltersStore.value = {
    ...behaviorsFiltersStore.value,
    direction,
  };
};

export const setBehaviorsFilter = (filterKey: TreeFilters, value: boolean) => {
  behaviorsFiltersStore.value = {
    ...behaviorsFiltersStore.value,
    filter: {
      ...behaviorsFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

export const fetchBehaviorsData = async () => {
  behaviorsStore.value = {
    ...behaviorsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AwesomeTree>("widgets/behaviors.json", { bustCache: true });

    behaviorsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    behaviorsStore.value = {
      ...behaviorsStore.value,
      error: e.message,
      loading: false,
    };
  }
};
