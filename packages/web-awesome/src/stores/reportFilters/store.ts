import type { Transition } from "@allurereport/web-commons";
import {
  flakyFilter,
  retryFilter,
  setFlakyFilter,
  setRetryFilter,
  setTransitionFilter,
  transitionFilter,
  tagsFilter,
  queryFilter,
  setQueryFilter,
  setTagsFilter,
  statusFilter,
  setStatusFilter,
} from "@allurereport/web-commons";
import { computed } from "@preact/signals";
import type { AwesomeArrayFieldFilter, AwesomeBooleanFieldFilter, AwesomeFilter, AwesomeFilterGroupSimple, AwesomeStringFieldFilter } from "./model";
import type { AwesomeStatus } from "types";

const statusAwesomeFilter = computed<AwesomeStringFieldFilter>(() => ({
  type: "field",
  logicalOperator: "AND",
  value: {
    key: "status",
    value: statusFilter.value,
    type: "string",
    strict: false,
  },
}));

export const queryAwesomeFilter = computed<AwesomeFilterGroupSimple>(() => {
  return {
    type: "group",
    logicalOperator: "AND",
    value: [
      {
        type: "field",
        logicalOperator: "OR",
        value: {
          key: "name",
          value: queryFilter.value,
          type: "string",
          strict: false,
        },
      },
      {
        type: "field",
        logicalOperator: "OR",
        value: {
          key: "id",
          value: queryFilter.value,
          type: "string",
          strict: false,
        },
      },
    ],
  };
});

export const queryAwesomeFilterValue = computed(() => queryAwesomeFilter.value.value[0].value.value as string);

export const setQueryAwesomeFilter = (query: string) => {
  setQueryFilter(query);
};

const retryAwesomeFilter = computed<AwesomeBooleanFieldFilter>(() => {
  return {
    type: "field",
    logicalOperator: "OR",
    value: {
      key: "retry",
      value: !!retryFilter.value,
      type: "boolean",
    },
  };
});

const flakyAwesomeFilter = computed<AwesomeBooleanFieldFilter>(() => {
  return {
    type: "field",
    logicalOperator: "OR",
    value: {
      key: "flaky",
      value: !!flakyFilter.value,
      type: "boolean",
    },
  };
});

const transitionAwesomeFilter = computed<AwesomeFilterGroupSimple>(() => ({
  type: "group",
  logicalOperator: "AND",
  fieldKey: "transition",
  value: transitionFilter.value.map((transition) => ({
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

const tagsAwesomeFilter = computed<AwesomeArrayFieldFilter>(() => ({
  type: "field",
  logicalOperator: "AND",
  value: {
    key: "tags",
    value: tagsFilter.value,
    type: "array",
    strict: false,
  },
}));

export const quickAwesomeFilters = computed(() => {
  return [
    retryAwesomeFilter.value,
    flakyAwesomeFilter.value,
    transitionAwesomeFilter.value,
    tagsAwesomeFilter.value,
  ] as AwesomeFilter[];
});

export const awesomeFilters = computed(() => {
  const filters: AwesomeFilter[] = [];

  if (queryAwesomeFilterValue.value) {
    filters.push(queryAwesomeFilter.value);
  }

  const hasBothRetryAndFlaky = retryFilter.value && flakyFilter.value;

  if (hasBothRetryAndFlaky) {
    filters.push({
      type: "group",
      logicalOperator: "AND",
      value: [{...retryAwesomeFilter.value, logicalOperator: "OR"}, {...flakyAwesomeFilter.value, logicalOperator: "OR"}],
    });
  }

  if (!hasBothRetryAndFlaky && retryFilter.value) {
    filters.push({...retryAwesomeFilter.value, logicalOperator: "AND"});
  }

  if (!hasBothRetryAndFlaky && flakyFilter.value) {
    filters.push({...flakyAwesomeFilter.value, logicalOperator: "AND"});
  }

  if (transitionFilter.value.length > 0) {
    filters.push(transitionAwesomeFilter.value);
  }

  if (tagsFilter.value.length > 0) {
    filters.push(tagsAwesomeFilter.value);
  }

  if (statusFilter.value) {
    filters.push(statusAwesomeFilter.value);
  }


  return filters;
});

export const setAwesomeFilter = (filter: AwesomeFilter) => {
  if (filter.type === "group" && filter.fieldKey === "transition") {
    const transitions: Transition[] = [];
    for (const v of filter.value) {
      if (v.type === "field" && v.value.type === "string" && v.value.key === "transition") {
        transitions.push(v.value.value as Transition);
      }
    }

    setTransitionFilter(transitions);
  }

  if (filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "retry") {
    setRetryFilter(filter.value.value as boolean);
  }

  if (filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "flaky") {
    setFlakyFilter(filter.value.value as boolean);
  }

  if (filter.type === "field" && filter.value.type === "array" && filter.value.key === "tags") {
    setTagsFilter(filter.value.value as string[]);
  }
};

export const treeAwesomeStatus = computed<AwesomeStatus>(() => statusFilter.value ?? "total");

export const setTreeAwesomeStatus = (status: AwesomeStatus) => {
  setStatusFilter(status === "total" ? undefined : status);
};

export const clearAwesomeFilters = () => {
  setQueryFilter("");
  setRetryFilter(false);
  setFlakyFilter(false);
  setTransitionFilter([]);
  setTagsFilter([]);
  setStatusFilter();
};
