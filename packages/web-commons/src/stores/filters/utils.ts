import type { TestStatus } from "@allurereport/core-api";
import { setToStorage } from "../storage/index.js";
import { getCurrentUrl } from "../url/helpers.js";
import { DIRECTIONS, PARAMS, SORT_BY_FIELDS, SORT_BY_STORAGE_KEY, STATUSES, TRANSITIONS } from "./constants.js";
import type { Direction, Filters, SortBy, SortByField, Transition } from "./types.js";

export const validateSortBy = (sortBy: string): sortBy is SortBy => {
  const parts = sortBy.split(",");
  if (parts.length !== 2) {
    return false;
  }
  const [field, direction] = parts;

  return SORT_BY_FIELDS.includes(field as SortByField) && DIRECTIONS.includes(direction as Direction);
};

export const validateTransition = (transition: string): transition is Transition => {
  return TRANSITIONS.includes(transition as Transition);
};

export const validateStatus = (status: string): status is TestStatus => {
  return STATUSES.includes(status as TestStatus);
};

export const constructFilterParams = (filters: Filters) => {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set(PARAMS.QUERY, filters.query);
  }

  if (filters.status) {
    params.set(PARAMS.STATUS, filters.status);
  }

  if (filters.flaky) {
    params.set(PARAMS.FLAKY, "true");
  }

  if (filters.retry) {
    params.set(PARAMS.RETRY, "true");
  }

  if (filters.transition) {
    filters.transition.forEach((transition) => {
      params.set(PARAMS.TRANSITION, transition);
    });
  }

  if (filters.tags) {
    filters.tags.forEach((tag) => {
      params.set(PARAMS.TAGS, tag);
    });
  }

  if (filters.status) {
    params.set(PARAMS.STATUS, filters.status);
  }

  if (filters.sortBy) {
    params.set(PARAMS.SORT_BY, filters.sortBy);
  }

  return params;
};

export const restoreFiltersFromParams = (params: URLSearchParams): Omit<Filters, "sortBy"> => {
  const filters: Filters = {};

  const query = params.get(PARAMS.QUERY);
  const status = params.get(PARAMS.STATUS) ?? undefined;
  const flaky = params.get(PARAMS.FLAKY) === "true";
  const retry = params.get(PARAMS.RETRY) === "true";
  const transition = params.getAll(PARAMS.TRANSITION) ?? [];
  const tags = params.getAll(PARAMS.TAGS) ?? [];

  if (query) {
    filters.query = query;
  }

  if (flaky) {
    filters.flaky = true;
  }

  if (retry) {
    filters.retry = true;
  }

  const validTransitions = transition.filter((t) => validateTransition(t));
  filters.transition = validTransitions;

  filters.tags = tags;

  if (status && validateStatus(status)) {
    filters.status = status;
  }

  return filters;
};

export const persistSortByToStorage = (sortBy: SortBy) => {
  setToStorage(SORT_BY_STORAGE_KEY, sortBy);
};

export const migrateFilterParam = () => {
  if (typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(getCurrentUrl());

  const hasFilterParam = currentUrl.searchParams.has("filter");

  if (!hasFilterParam) {
    return;
  }

  const filtersParam = currentUrl.searchParams.getAll("filter") ?? [];

  const retryParamFromFilter = filtersParam.includes("retry");
  const flakyParamFromFilter = filtersParam.includes("flaky");
  const retryParamFromUrl = currentUrl.searchParams.get("retry") === "true";
  const flakyParamFromUrl = currentUrl.searchParams.get("flaky") === "true";
  const transitionParamFromUrl = currentUrl.searchParams.get("transition") ?? undefined;
  const transitionParam = filtersParam.find((filter) => validateTransition(filter));

  if (retryParamFromFilter || retryParamFromUrl) {
    currentUrl.searchParams.set("retry", "true");
  } else {
    currentUrl.searchParams.delete("retry");
  }

  if (flakyParamFromFilter || flakyParamFromUrl) {
    currentUrl.searchParams.set("flaky", "true");
  } else {
    currentUrl.searchParams.delete("flaky");
  }

  if (transitionParamFromUrl || transitionParam) {
    currentUrl.searchParams.set("transition", transitionParam ?? "");
  } else {
    currentUrl.searchParams.delete("transition");
  }

  currentUrl.searchParams.delete("filter");

  window.history.replaceState(null, "", currentUrl.toString());
  window.dispatchEvent(new Event("replaceState"));
};
