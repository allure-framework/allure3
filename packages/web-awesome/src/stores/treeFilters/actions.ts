import type { ResolutionCategory, TestStatus, TestStatusTransition } from "@allurereport/core-api";
import { ReportFetchError, fetchReportJsonData, setParams } from "@allurereport/web-commons";

import { PARAMS } from "./constants";
import type { TreeFiltersData } from "./model";
import { treeCategories, treeTags } from "./store";

const preserveTreeScrollPosition = (apply: () => void) => {
  const containers = Array.from(document.querySelectorAll("[data-tree-scroll-container]")).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  const positions = containers.map((element) => ({
    element,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
  }));
  const windowScrollX = window.scrollX;
  const windowScrollY = window.scrollY;

  const restore = () => {
    positions.forEach(({ element, scrollLeft, scrollTop }) => {
      element.scrollLeft = scrollLeft;
      element.scrollTop = scrollTop;
    });
    window.scrollTo(windowScrollX, windowScrollY);
  };

  apply();
  window.requestAnimationFrame(restore);
};

export const setQueryFilter = (query?: string) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.QUERY,
      value: query?.trim() === "" ? undefined : query,
    });
  });
};

export const setStatusFilter = (status?: TestStatus) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.STATUS,
      value: status,
    });
  });
};

export const setFlakyFilter = (flaky?: boolean) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.FLAKY,
      value: flaky ? "true" : undefined,
    });
  });
};

export const setRetryFilter = (retry?: boolean) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.RETRY,
      value: retry ? "true" : undefined,
    });
  });
};

export const setResolutionFilter = (resolution: ResolutionCategory[]) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.RESOLUTION,
      value: resolution,
    });
  });
};

export const setTransitionFilter = (transitions: TestStatusTransition[]) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.TRANSITION,
      value: transitions,
    });
  });
};

export const setTagsFilter = (tags: string[]) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.TAGS,
      value: tags,
    });
  });
};

export const setCategoriesFilter = (categories: string[]) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.CATEGORIES,
      value: categories,
    });
  });
};

export const setSeverityFilter = (severities: string[]) => {
  preserveTreeScrollPosition(() => {
    setParams({
      key: PARAMS.SEVERITY,
      value: severities,
    });
  });
};

export const clearTreeFilterParams = () => {
  preserveTreeScrollPosition(() => {
    setParams(
      { key: PARAMS.QUERY, value: undefined },
      { key: PARAMS.RETRY, value: undefined },
      { key: PARAMS.FLAKY, value: undefined },
      { key: PARAMS.RESOLUTION, value: [] },
      { key: PARAMS.TRANSITION, value: [] },
      { key: PARAMS.TAGS, value: [] },
      { key: PARAMS.CATEGORIES, value: [] },
      { key: PARAMS.SEVERITY, value: [] },
      { key: PARAMS.STATUS, value: undefined },
    );
  });
};

export const fetchTreeFiltersData = async () => {
  try {
    const response = await fetchReportJsonData<TreeFiltersData>("widgets/tree-filters.json", { bustCache: true });

    treeTags.value = response.tags;
    treeCategories.value = response.categories ?? [];
  } catch (error) {
    if (error instanceof ReportFetchError && error.response.status === 404) {
      treeTags.value = [];
      treeCategories.value = [];
      return;
    }

    // eslint-disable-next-line no-console
    console.error("Failed to fetch tree filters data:\n\n", error);
  }
};
