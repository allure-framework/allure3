import type { TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { getParamValue, getParamValues } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AwesomeStatus } from "types";
import {
  setFlakyFilter,
  setQueryFilter,
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
  isFlakyFilter,
  isRetryFilter,
  isTagFilter,
  isTransitionFilter,
  validateStatus,
  validateTransition,
} from "./utils";

export const treeTags = signal<string[]>([]);

const hasTreeTags = computed(() => treeTags.value.length > 0);

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

export const treeQueryFilter = computed<AwesomeFilterGroupSimple>(() => {
  return {
    type: "group",
    logicalOperator: "AND",
    value: [
      {
        type: "field",
        logicalOperator: "OR",
        value: {
          key: "name",
          value: urlQueryFilter.value,
          type: "string",
          strict: false,
        },
      },
      {
        type: "field",
        logicalOperator: "OR",
        value: {
          key: "id",
          value: urlQueryFilter.value,
          type: "string",
          strict: false,
        },
      },
    ],
  };
});

export const treeQueryFilterValue = computed(() => treeQueryFilter.value.value[0].value.value as string);

export const setTreeQueryFilter = (query: string) => {
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

export const treeQuickFilters = computed<AwesomeFilter[]>(() => [
  treeRetryFilter.value,
  treeFlakyFilter.value,
  treeTransitionFilter.value,
  treeTagsFilter.value,
]);

export const treeFilters = computed(() => {
  const filters: AwesomeFilter[] = [];

  if (treeQueryFilterValue.value) {
    filters.push(treeQueryFilter.value);
  }

  const hasBothRetryAndFlaky = urlRetryFilter.value && urlFlakyFilter.value;

  if (hasBothRetryAndFlaky) {
    filters.push({
      type: "group",
      logicalOperator: "AND",
      value: [
        { ...treeRetryFilter.value, logicalOperator: "OR" },
        { ...treeFlakyFilter.value, logicalOperator: "OR" },
      ],
    });
  }

  if (!hasBothRetryAndFlaky && urlRetryFilter.value) {
    filters.push({ ...treeRetryFilter.value, logicalOperator: "AND" });
  }

  if (!hasBothRetryAndFlaky && urlFlakyFilter.value) {
    filters.push({ ...treeFlakyFilter.value, logicalOperator: "AND" });
  }

  if (urlTransitionFilter.value.length > 0) {
    filters.push(treeTransitionFilter.value);
  }

  if (urlTagsFilter.value.length > 0) {
    filters.push(treeTagsFilter.value);
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

  if (
    isTagFilter(filter) &&
    // Apply tags filter only if there are tags to filter by
    hasTreeTags.peek()
  ) {
    setTagsFilter(filter.value.value);
  }
};

export const treeStatus = computed<AwesomeStatus>(() => urlStatusFilter.value ?? "total");

export const setTreeStatus = (status: AwesomeStatus) => {
  setStatusFilter(status === "total" ? undefined : status);
};

export const clearTreeFilters = () => {
  setQueryFilter("");
  setRetryFilter(false);
  setFlakyFilter(false);
  setTransitionFilter([]);
  setTagsFilter([]);
  setStatusFilter();
};
