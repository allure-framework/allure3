import type { ResolutionCategory, TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { getParamValue, getParamValues } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { ReportStatus } from "types";

import {
  clearTreeFilterParams,
  setCategoriesFilter,
  setFlakyFilter,
  setQueryFilter,
  setResolutionFilter,
  setRetryFilter,
  setStatusFilter,
  setTagsFilter,
  setTransitionFilter,
} from "./actions";
import { PARAMS } from "./constants";
import type {
  AwesomeArrayFieldFilter,
  AwesomeBooleanFieldFilter,
  AwesomeFilter,
  AwesomeFilterGroupSimple,
  AwesomeStringFieldFilter,
} from "./model";
import {
  hasActiveFilters,
  isCategoryFilter,
  isFlakyFilter,
  isResolutionFilter,
  isRetryFilter,
  isTagFilter,
  isTransitionFilter,
  validateStatus,
  validateTransition,
  validateResolution,
} from "./utils";

export const treeTags = signal<string[]>([]);
export const treeCategories = signal<string[]>([]);
export const treeFiltersResetNonce = signal(0);

const hasTreeTags = computed(() => treeTags.value.length > 0);
const hasTreeCategories = computed(() => treeCategories.value.length > 0);

const urlQueryFilter = computed<string | undefined>(() => {
  const queryValue = getParamValue(PARAMS.QUERY) ?? "";

  if (queryValue.trim() === "") {
    return undefined;
  }

  return queryValue;
});

const urlStatusFilter = computed<TestStatus | undefined>(() => {
  const status = getParamValue(PARAMS.STATUS) ?? undefined;

  if (status && validateStatus(status)) {
    return status;
  }

  return undefined;
});

const urlFlakyFilter = computed(() => getParamValue(PARAMS.FLAKY) === "true");
const urlRetryFilter = computed(() => getParamValue(PARAMS.RETRY) === "true");

const EMPTY_RESOLUTIONS: ResolutionCategory[] = [];

const urlResolutionFilter = computed(() => {
  const resolutions = getParamValues(PARAMS.RESOLUTION) ?? EMPTY_RESOLUTIONS;

  if (resolutions.length === 0) {
    return EMPTY_RESOLUTIONS;
  }

  return resolutions.filter((resolution) => validateResolution(resolution));
});

const EMPTY_TRANSITIONS: TestStatusTransition[] = [];

const urlTransitionFilter = computed(() => {
  const transitions = getParamValues(PARAMS.TRANSITION) ?? EMPTY_TRANSITIONS;

  if (transitions.length === 0) {
    return EMPTY_TRANSITIONS;
  }

  return transitions.filter((transition) => validateTransition(transition));
});

const EMPTY_TAGS: string[] = [];

const urlTagsFilter = computed<string[]>(() => {
  const tags = getParamValues(PARAMS.TAGS) ?? EMPTY_TAGS;

  if (tags.length === 0) {
    return EMPTY_TAGS;
  }

  if (treeTags.value.length === 0) {
    return tags;
  }

  return tags.filter((tag) => treeTags.value.includes(tag));
});

const EMPTY_CATEGORIES: string[] = [];

const urlCategoriesFilter = computed<string[]>(() => {
  const categories = getParamValues(PARAMS.CATEGORIES) ?? EMPTY_CATEGORIES;

  if (categories.length === 0) {
    return EMPTY_CATEGORIES;
  }

  if (treeCategories.value.length === 0) {
    return categories;
  }

  return categories.filter((category) => treeCategories.value.includes(category));
});

const treeStatusFilter = computed<AwesomeStringFieldFilter>(() => ({
  type: "field",
  logicalOperator: "AND",
  value: {
    key: "status",
    value: urlStatusFilter.value,
    type: "string",
    strict: false,
  },
}));

export const treeQueryFilterValue = computed(() => urlQueryFilter.value);

export const setTreeQueryFilter = (query?: string) => {
  setQueryFilter(query);
};

const treeRetryFilter = computed<AwesomeBooleanFieldFilter>(() => {
  return {
    type: "field",
    logicalOperator: "OR",
    value: {
      key: "retry",
      value: !!urlRetryFilter.value,
      type: "boolean",
    },
  };
});

const treeFlakyFilter = computed<AwesomeBooleanFieldFilter>(() => ({
  type: "field",
  logicalOperator: "OR",
  value: {
    key: "flaky",
    value: !!urlFlakyFilter.value,
    type: "boolean",
  },
}));

const treeResolutionFilter = computed<AwesomeFilterGroupSimple>(() => ({
  type: "group",
  logicalOperator: "AND",
  fieldKey: "resolution",
  value: urlResolutionFilter.value.map((resolution) => ({
    type: "field",
    logicalOperator: "OR",
    value: {
      key: "resolution",
      value: resolution,
      type: "string",
      strict: true,
    },
  })),
}));

const treeTransitionFilter = computed<AwesomeFilterGroupSimple>(() => ({
  type: "group",
  logicalOperator: "AND",
  fieldKey: "transition",
  value: urlTransitionFilter.value.map((transition) => ({
    type: "field",
    value: {
      key: "transition",
      value: transition,
      type: "string",
      logicalOperator: "OR",
      strict: true,
    },
  })),
}));

const treeTagsFilter = computed<AwesomeArrayFieldFilter>(() => ({
  type: "field",
  logicalOperator: "AND",
  value: {
    key: "tags",
    value: urlTagsFilter.value,
    type: "array",
    strict: false,
  },
}));

const treeCategoriesFilter = computed<AwesomeArrayFieldFilter>(() => ({
  type: "field",
  logicalOperator: "AND",
  value: {
    key: "categories",
    value: urlCategoriesFilter.value,
    type: "array",
    strict: false,
  },
}));

export const treeQuickFilters = computed<AwesomeFilter[]>(() => [
  treeRetryFilter.value,
  treeFlakyFilter.value,
  treeResolutionFilter.value,
  treeTransitionFilter.value,
  treeTagsFilter.value,
  treeCategoriesFilter.value,
]);

export const hasActiveTreeFilters = computed(() =>
  hasActiveFilters({
    query: urlQueryFilter.value,
    status: urlStatusFilter.value,
    flaky: urlFlakyFilter.value,
    retry: urlRetryFilter.value,
    resolution: urlResolutionFilter.value,
    transition: urlTransitionFilter.value,
    tags: urlTagsFilter.value,
    categories: urlCategoriesFilter.value,
  }),
);

export const treeNonQueryFilters = computed(() => {
  const filters: AwesomeFilter[] = [];
  const markerFilters: AwesomeFilter[] = [];

  if (urlRetryFilter.value) {
    markerFilters.push(treeRetryFilter.value);
  }

  if (urlFlakyFilter.value) {
    markerFilters.push(treeFlakyFilter.value);
  }

  if (urlResolutionFilter.value.length > 0) {
    markerFilters.push(...treeResolutionFilter.value.value);
  }

  if (markerFilters.length === 1) {
    filters.push({ ...markerFilters[0], logicalOperator: "AND" });
  }

  if (markerFilters.length > 1) {
    filters.push({
      type: "group",
      logicalOperator: "AND",
      value: markerFilters.map((filter) => ({ ...filter, logicalOperator: "OR" })),
    });
  }

  if (urlTransitionFilter.value.length > 0) {
    filters.push(treeTransitionFilter.value);
  }

  if (urlTagsFilter.value.length > 0) {
    filters.push(treeTagsFilter.value);
  }

  if (urlCategoriesFilter.value.length > 0) {
    filters.push(treeCategoriesFilter.value);
  }

  if (urlStatusFilter.value) {
    filters.push(treeStatusFilter.value);
  }

  return filters;
});

export const setTreeFilter = (filter: AwesomeFilter) => {
  if (isTransitionFilter(filter)) {
    const transitions: TestStatusTransition[] = [];

    for (const v of filter.value) {
      if (v.type === "field" && v.value.type === "string" && v.value.key === "transition") {
        transitions.push(v.value.value as TestStatusTransition);
      }
    }

    setTransitionFilter(transitions);
  }

  if (isRetryFilter(filter)) {
    setRetryFilter(filter.value.value);
  }

  if (isFlakyFilter(filter)) {
    setFlakyFilter(filter.value.value);
  }

  if (isResolutionFilter(filter)) {
    const resolutions: ResolutionCategory[] = [];

    for (const v of filter.value) {
      if (v.type === "field" && v.value.type === "string" && v.value.key === "resolution") {
        resolutions.push(v.value.value as ResolutionCategory);
      }
    }

    setResolutionFilter(resolutions);
  }

  if (
    isTagFilter(filter) &&
    // Apply tags filter only if there are tags to filter by
    hasTreeTags.peek()
  ) {
    setTagsFilter(filter.value.value);
  }

  if (
    isCategoryFilter(filter) &&
    // Apply categories filter only if there are categories to filter by
    hasTreeCategories.peek()
  ) {
    setCategoriesFilter(filter.value.value);
  }
};

export const treeStatus = computed<ReportStatus>(() => urlStatusFilter.value ?? "total");

export const setTreeStatus = (status: ReportStatus) => {
  setStatusFilter(status === "total" ? undefined : status);
};

export const clearTreeFilters = () => {
  treeFiltersResetNonce.value += 1;
  clearTreeFilterParams();
};
