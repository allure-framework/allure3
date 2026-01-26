import { getParamValue, hasParam, setParams } from "@allurereport/web-commons";
import { computed, effect } from "@preact/signals";

export type SortByDirection = "asc" | "desc";
export type SortByField = "order" | "duration" | "status" | "name";
export type SortBy = `${SortByField},${SortByDirection}`;

const DEFAULT_SORT_BY: SortBy = "order,asc";

export const DIRECTIONS: SortByDirection[] = ["asc", "desc"];

export const SORT_BY_STORAGE_KEY = "ALLURE_REPORT_SORT_BY";
export const SORT_BY_FIELDS: SortByField[] = ["order", "duration", "status", "name"];

const SORT_BY_PARAM = "sortBy";

const hasSortByParam = computed(() => hasParam(SORT_BY_PARAM));

export const setSortBy = (sortByValue: SortBy) => {
  if (hasSortByParam.peek()) {
    setParams({
      key: SORT_BY_PARAM,
      value: undefined,
    });
  }

  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SORT_BY_STORAGE_KEY, sortByValue);
};

const validateSortBy = (sortByValue: string): sortByValue is SortBy => {
  const parts = sortByValue.split(",");
  if (parts.length !== 2) {
    return false;
  }
  const [field, direction] = parts;

  return SORT_BY_FIELDS.includes(field as SortByField) && DIRECTIONS.includes(direction as SortByDirection);
};

export const sortBy = computed<SortBy>(() => {
  const urlSortBy = getParamValue(SORT_BY_PARAM) ?? undefined;

  // SortBy from URL is taking precedence over the storage value
  if (urlSortBy && validateSortBy(urlSortBy.toLowerCase())) {
    return urlSortBy.toLowerCase() as SortBy;
  }

  if (typeof window === "undefined") {
    return DEFAULT_SORT_BY;
  }

  const storageSortBy = localStorage.getItem(SORT_BY_STORAGE_KEY);

  if (storageSortBy && validateSortBy(storageSortBy.toLowerCase())) {
    return storageSortBy.toLowerCase() as SortBy;
  }

  return DEFAULT_SORT_BY;
});

effect(() => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SORT_BY_STORAGE_KEY, sortBy.value);
});
