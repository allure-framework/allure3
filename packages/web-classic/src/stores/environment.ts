import type { EnvironmentItem } from "@allurereport/core-api";
import { fetchReportJsonData, errorMessageFromUnknown } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export const environmentStore = signal<StoreSignalState<EnvironmentItem[]>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchEnvironmentData = async () => {
  environmentStore.value = {
    ...environmentStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<EnvironmentItem[]>("widgets/allure_environment.json", { bustCache: true });

    environmentStore.value = {
      data: res ?? [],
      error: undefined,
      loading: false,
    };
  } catch (err) {
    environmentStore.value = {
      data: undefined,
      error: errorMessageFromUnknown(err),
      loading: false,
    };
  }
};
