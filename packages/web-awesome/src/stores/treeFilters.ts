import { signal } from "@preact/signals";
import type { TreeFiltersState } from "@/stores/tree";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";

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
