import { fetchReportJsonData } from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";

export const environments = signal<StoreSignalState<string[]>>({
  loading: false,
  error: undefined,
  data: [],
});

export const collapsedEnvironments = signal<string[]>(loadFromLocalStorage<string[]>("collapsedEnvironments", []));

export const currentEnvironment = signal<string>(loadFromLocalStorage<string>("currentEnvironment", "default"));

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

effect(() => {
  localStorage.setItem("currentEnvironment", JSON.stringify(currentEnvironment.value));
});

effect(() => {
  localStorage.setItem("collapsedEnvironments", JSON.stringify([...collapsedEnvironments.value]));
});
