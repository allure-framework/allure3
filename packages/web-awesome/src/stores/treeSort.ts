import { getParamValue, hasParam, setParams } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";

export type SortByDirection = "asc" | "desc";
export type SortByField = "order" | "duration" | "status" | "name";
export type SortBy = `${SortByField},${SortByDirection}`;

const DEFAULT_SORT_BY: SortBy = "order,asc";

export const DIRECTIONS: SortByDirection[] = ["asc", "desc"];

export const SORT_BY_STORAGE_KEY = "ALLURE_REPORT_SORT_BY";
export const SORT_BY_FIELDS: SortByField[] = ["order", "duration", "status", "name"];

const SORT_BY_PARAM = "sortBy";

const hasSortByParam = computed(() => hasParam(SORT_BY_PARAM));

const validateSortBy = (sortByValue: string): sortByValue is SortBy => {
  const parts = sortByValue.split(",");
  if (parts.length !== 2) {
    return false;
  }
  const [field, direction] = parts;

  return SORT_BY_FIELDS.includes(field as SortByField) && DIRECTIONS.includes(direction as SortByDirection);
};

const getInitialSortBy = (): SortBy => {
  if (typeof window === "undefined") {
    return DEFAULT_SORT_BY;
  }
  const stored = localStorage.getItem(SORT_BY_STORAGE_KEY);
  if (stored && validateSortBy(stored.toLowerCase())) {
    return stored.toLowerCase() as SortBy;
  }
  return DEFAULT_SORT_BY;
};

const sortBySignal = signal<SortBy>(getInitialSortBy());

export const setSortBy = (sortByValue: SortBy) => {
  if (hasSortByParam.peek()) {
    setParams({
      key: SORT_BY_PARAM,
      value: undefined,
    });
  }

  sortBySignal.value = sortByValue;
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

  return sortBySignal.value;
});

effect(() => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SORT_BY_STORAGE_KEY, sortBy.value);
});
