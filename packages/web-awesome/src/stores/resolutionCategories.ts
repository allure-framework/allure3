import { ReportFetchError, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { ReportResolutionCategories } from "types";

import type { StoreSignalState } from "@/stores/types";

export const resolutionCategoriesStore = signal<StoreSignalState<ReportResolutionCategories>>({
  loading: true,
  error: undefined,
  data: undefined,
});

let lastResolutionCategoriesEnv: string | undefined;

const emptyResolutionCategories: ReportResolutionCategories = {
  groups: [],
};

const resolveResolutionCategoriesPath = (env?: string) =>
  env ? `widgets/${env}/resolution-categories.json` : "widgets/resolution-categories.json";

const isMissingResolutionCategoriesError = (error: unknown) =>
  error instanceof ReportFetchError && error.response.status === 404;

export const fetchResolutionCategoriesData = async (env?: string) => {
  if (lastResolutionCategoriesEnv === env && resolutionCategoriesStore.peek().data) {
    return;
  }

  lastResolutionCategoriesEnv = env;
  resolutionCategoriesStore.value = {
    ...resolutionCategoriesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<ReportResolutionCategories>(resolveResolutionCategoriesPath(env));

    resolutionCategoriesStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (error) {
    if (isMissingResolutionCategoriesError(error)) {
      resolutionCategoriesStore.value = {
        data: emptyResolutionCategories,
        error: undefined,
        loading: false,
      };
      return;
    }

    resolutionCategoriesStore.value = {
      data: undefined,
      error: errorMessageFromUnknown(error),
      loading: false,
    };
    lastResolutionCategoriesEnv = undefined;
  }
};
