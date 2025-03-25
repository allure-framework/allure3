import { signal } from "@preact/signals";
import { setTreeStatus } from "@/stores/tree";
import { treeFiltersStore } from "@/stores/treeFilters";
import type { AwesomeStatus } from "../../types";

export const currentTab = signal<string | undefined>(treeFiltersStore.value.status || "total");

export const setCurrentTab = (tab: string) => {
  if (tab === currentTab.value) {
    currentTab.value = "total";
    setTreeStatus(currentTab.value as AwesomeStatus);
    return;
  }

  currentTab.value = tab;
  setTreeStatus(currentTab.value as AwesomeStatus);
};
