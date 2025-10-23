import { fetchReportJsonData } from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

const loadFromLocalStorage = <T>(key: string, defaultValue?: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const environmentsStore = signal<StoreSignalState<string[]>>({
  loading: false,
  error: undefined,
  data: [],
});
export const collapsedEnvironments = signal<string[]>(loadFromLocalStorage<string[]>("collapsedEnvironments", []));

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
    const res = await fetchReportJsonData<string[]>("widgets/environments.json", { bustCache: true });

    environmentsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    environmentsStore.value = {
      ...environmentsStore.value,
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
