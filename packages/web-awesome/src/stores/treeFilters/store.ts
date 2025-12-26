import { batch, computed, effect, signal } from "@preact/signals";
import type { AwesomeStatus } from "types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";
import { persist } from "@/utils/persist";
import { transitionFiltersList } from "./constants";
import type { TreeDirection, TreeFilters, TreeFiltersState, TreeSortBy } from "./types";

export const treeQuery = signal<string>("");
export const treeStatus = signal<AwesomeStatus>("total");
export const treeSortBy = signal<TreeSortBy>("order");
export const treeDirection = signal<TreeDirection>("asc");
export const treeFilter = signal<Record<TreeFilters, boolean>>({
  flaky: false,
  retry: false,
  new: false,
  fixed: false,
  regressed: false,
  malfunctioned: false,
});

const initialized = signal(false);

const init = () => {
  const initialState = loadFromLocalStorage<TreeFiltersState>("treeFilters", {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
      fixed: false,
      regressed: false,
      malfunctioned: false,
    },
    sortBy: "order",
    direction: "asc",
  });

  batch(() => {
    treeQuery.value = initialState.query;
    treeStatus.value = initialState.status;
    treeSortBy.value = initialState.sortBy;
    treeDirection.value = initialState.direction;
    treeFilter.value = initialState.filter;
    initialized.value = true;
  });
};

init();

const treeFiltersState = computed(() => ({
  query: treeQuery.value,
  status: treeStatus.value,
  sortBy: treeSortBy.value,
  direction: treeDirection.value,
  filter: treeFilter.value,
}));

effect(() => {
  if (!initialized.value) {
    return;
  }

  persist(["treeFilters", treeFiltersState.value]);
});

export const transitionFilters = computed(() =>
  transitionFiltersList.map((transition) => [transition, treeFilter.value[transition]] as const),
);

export const testTypeFilters = computed(() =>
  (["flaky", "retry"] as const).map((testType) => [testType, treeFilter.value[testType]] as const),
);
