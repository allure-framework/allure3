import { computed } from "@preact/signals-core";
import { getStorageValue } from "../storage/index.js";
import { currentUrl, getParamValue } from "../url/index.js";
import { DEFAULT_SORT_BY, PARAMS, SORT_BY_STORAGE_KEY } from "./constants.js";
import type { SortBy } from "./types.js";
import { restoreFiltersFromParams, validateSortBy } from "./utils.js";

export const filters = computed(() => restoreFiltersFromParams(new URLSearchParams(currentUrl.value.search)));

export const sortBy = computed<SortBy>(() => {
  const urlSortBy = getParamValue(PARAMS.SORT_BY) ?? undefined;

  // SortBy from URL is taking precedence over the storage value
  if (urlSortBy && validateSortBy(urlSortBy.toLowerCase())) {
    return urlSortBy.toLowerCase() as SortBy;
  }

  const storageSortBy = getStorageValue(SORT_BY_STORAGE_KEY);

  if (storageSortBy && validateSortBy(storageSortBy.toLowerCase())) {
    return storageSortBy.toLowerCase() as SortBy;
  }

  return DEFAULT_SORT_BY;
});

export const queryFilter = computed(() => filters.value.query);
export const statusFilter = computed(() => filters.value.status);
export const flakyFilter = computed(() => filters.value.flaky);
export const retryFilter = computed(() => filters.value.retry);
export const transitionFilter = computed(() => filters.value.transition);
export const tagsFilter = computed(() => filters.value.tags);
