import type { TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { MAX_ARRAY_FIELD_VALUES, getCurrentUrl } from "@allurereport/web-commons";
import { PARAMS, STATUSES, TRANSITIONS } from "./constants";
import type {
  AwesomeArrayFieldFilter,
  AwesomeBooleanFieldFilter,
  AwesomeFilter,
  AwesomeFilterGroupSimple,
  Filters,
} from "./model";

export const truncateArrayFieldValues = (values: string[]): string[] => {
  return values.slice(0, MAX_ARRAY_FIELD_VALUES);
};

export const getTagsFilterUrl = (tags: string[]): string => {
  const url = new URL(window.location.pathname, window.location.origin);

  tags.forEach((tag) => {
    url.searchParams.append("tags", tag);
  });

  return url.toString();
};

export const validateTransition = (transition: string): transition is TestStatusTransition => {
  return TRANSITIONS.includes(transition as TestStatusTransition);
};

export const validateStatus = (status: string): status is TestStatus => {
  return STATUSES.includes(status as TestStatus);
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

  return params;
};

export const isRetryFilter = (filter: AwesomeFilter): filter is AwesomeBooleanFieldFilter => {
  return filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "retry";
};

export const isFlakyFilter = (filter: AwesomeFilter): filter is AwesomeBooleanFieldFilter => {
  return filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "flaky";
};

export const isTagFilter = (filter: AwesomeFilter): filter is AwesomeArrayFieldFilter => {
  return filter.type === "field" && filter.value.type === "array" && filter.value.key === "tags";
};

export const isTransitionFilter = (filter: AwesomeFilter): filter is AwesomeFilterGroupSimple => {
  return filter.type === "group" && filter.fieldKey === "transition";
};
