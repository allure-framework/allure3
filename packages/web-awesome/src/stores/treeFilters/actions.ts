import type { TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { ReportFetchError, fetchReportJsonData, setParams } from "@allurereport/web-commons";
import { PARAMS } from "./constants";
import type { TreeFiltersData } from "./model";
import { treeTags } from "./store";

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

export const setTransitionFilter = (transitions: TestStatusTransition[]) => {
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

export const fetchTreeFiltersData = async () => {
  try {
    const response = await fetchReportJsonData<TreeFiltersData>("widgets/tree-filters.json", { bustCache: true });

    treeTags.value = response.tags;
  } catch (error) {
    if (error instanceof ReportFetchError && error.response.status === 404) {
      treeTags.value = [];
      return;
    }

    // eslint-disable-next-line no-console
    console.error("Failed to fetch tree filters data:\n\n", error);
  }
};
