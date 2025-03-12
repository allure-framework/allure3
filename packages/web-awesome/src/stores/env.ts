import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const environments = signal<StoreSignalState<string[]>>({
  loading: false,
  error: undefined,
  data: [],
});

export const currentEnvironment = signal<string | undefined>(undefined);

export const setCurrentEnvironment = (env: string) => {
  currentEnvironment.value = env;
};

export const fetchEnvironments = async () => {
  environments.value = {
    ...environments.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<string[]>("widgets/environments.json");

    environments.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    environments.value = {
      ...environments.value,
      error: e.message,
      loading: false,
    };
  }
};
