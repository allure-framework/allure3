import type { TestStatus } from "@allurereport/core-api";
import { computed } from "@preact/signals-core";
import { hasParam, setParams } from "../url/index.js";
import { PARAMS } from "./constants.js";
import type { SortBy, Transition } from "./types.js";
import { persistSortByToStorage } from "./utils.js";

const hasSortByParam = computed(() => hasParam(PARAMS.SORT_BY));

const removeSortByFromUrl = () => {
  if (hasSortByParam.peek()) {
    setParams({
      key: PARAMS.SORT_BY,
      value: undefined,
    });
  }
};

export const setSortBy = (sortBy: SortBy) => {
  persistSortByToStorage(sortBy);
  removeSortByFromUrl();
};

export const setQueryFilter = (query?: string) => {
  setParams({
    key: PARAMS.QUERY,
    value: query?.trim() === "" ? undefined : query,
  });
};
export const setStatusFilter = (status?: TestStatus) => {
  setParams({
    key: PARAMS.STATUS,
    value: status,
  });
};

export const setFlakyFilter = (flaky?: boolean) => {
  setParams({
    key: PARAMS.FLAKY,
    value: flaky ? "true" : undefined,
  });
};

export const setRetryFilter = (retry?: boolean) => {
  setParams({
    key: PARAMS.RETRY,
    value: retry ? "true" : undefined,
  });
};

export const setTransitionFilter = (transitions: Transition[]) => {
  setParams({
    key: PARAMS.TRANSITION,
    value: transitions,
  });
};

export const setTagsFilter = (tags: string[]) => {
  setParams({
    key: PARAMS.TAGS,
    value: tags,
  });
};
