import type { EnvironmentItem } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const envInfoStore = signal<StoreSignalState<EnvironmentItem[]>>({
  loading: false,
  error: undefined,
  data: undefined,
});

export const fetchEnvInfo = async () => {
  envInfoStore.value = {
    ...envInfoStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<EnvironmentItem[]>("widgets/allure_environment.json", { bustCache: true });

    envInfoStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    envInfoStore.value = {
      ...envInfoStore.value,
      error: e.message,
      loading: false,
    };
  }
};
