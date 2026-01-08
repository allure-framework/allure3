import type { TestStatusTransition } from "@allurereport/core-api";
import { batch } from "@preact/signals";
import type { AwesomeStatus } from "types";
import { treeDirection, treeFilter, treeQuery, treeSortBy, treeStatus } from ".";
import { transitionFiltersList } from "./constants";
import type { TreeDirection, TreeSortBy } from "./types";

export const clearTreeFilters = () => {
  batch(() => {
    treeQuery.value = "";
    treeStatus.value = "total";
    treeFilter.value = {
      flaky: false,
      retry: false,
      new: false,
      fixed: false,
      regressed: false,
      malfunctioned: false,
    };
  });
};

export const setTreeQuery = (query: string) => {
  treeQuery.value = query;
};

export const setTreeStatus = (status: AwesomeStatus) => {
  treeStatus.value = status;
};

export const setTreeSortBy = (sortBy: TreeSortBy) => {
  treeSortBy.value = sortBy;
};

export const setTreeDirection = (direction: TreeDirection) => {
  treeDirection.value = direction;
};

export const setFilters = (filters: Record<string, boolean>) => {
  treeFilter.value = {
    ...treeFilter.peek(),
    ...filters,
  };
};

export const setTestTypeFilter = (testType: "flaky" | "retry", value: boolean) => {
  treeFilter.value = {
    ...treeFilter.peek(),
    [testType]: value,
  };
};

export const setTransitionFilter = (transition: TestStatusTransition, value: boolean) => {
  treeFilter.value = {
    ...treeFilter.peek(),
    ...transitionFiltersList.reduce(
      (acc, t) => {
        acc[t] = false;
        if (t === transition) {
          acc[t] = value;
        }
        return acc;
      },
      {} as Record<TestStatusTransition, boolean>,
    ),
  };
};
