import type { EnvironmentIdentity } from "@allurereport/core-api";
import {
  errorMessageFromUnknown,
  fetchReportJsonData,
  loadFromLocalStorage,
  migrateStoredEnvironmentSelection,
  normalizeEnvironmentsWidget,
} from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export const environmentsStore = signal<StoreSignalState<EnvironmentIdentity[]> & { data: EnvironmentIdentity[] }>({
  loading: false,
  error: undefined,
  data: [],
});

export const currentEnvironment = signal<string>(loadFromLocalStorage<string>("currentEnvironment", ""));

export const setCurrentEnvironment = (env: string) => {
  currentEnvironment.value = env;
};

export const fetchEnvironments = async () => {
  environmentsStore.value = {
    ...environmentsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const raw = await fetchReportJsonData<unknown>("widgets/environments.json", { bustCache: true });
    const res = normalizeEnvironmentsWidget(raw);

    environmentsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };

    currentEnvironment.value = migrateStoredEnvironmentSelection(currentEnvironment.value, res);
  } catch (e) {
    environmentsStore.value = {
      ...environmentsStore.value,
      error: errorMessageFromUnknown(e),
      loading: false,
    };
  }
};

effect(() => {
  localStorage.setItem("currentEnvironment", JSON.stringify(currentEnvironment.value));
});
