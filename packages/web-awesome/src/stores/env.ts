import { type EnvironmentIdentity, type TestEnvGroup } from "@allurereport/core-api";
import {
  environmentNameById as resolveEnvironmentNameById,
  fetchReportJsonData,
  migrateStoredEnvironmentSelection,
} from "@allurereport/web-commons";
import { effect, signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";

export const environmentsStore = signal<StoreSignalState<EnvironmentIdentity[]>>({
  loading: false,
  error: undefined,
  data: [],
});

export const testEnvGroupsStore = signal<StoreSignalState<Record<string, TestEnvGroup>>>({
  loading: false,
  error: undefined,
  data: {},
});

export const collapsedEnvironments = signal<string[]>(loadFromLocalStorage<string[]>("collapsedEnvironments", []));

export const currentEnvironment = signal<string>(loadFromLocalStorage<string>("currentEnvironment", ""));

export const setCurrentEnvironment = (env: string) => {
  currentEnvironment.value = env;
};

export const environmentNameById = (environmentId: string) =>
  resolveEnvironmentNameById(environmentsStore.peek().data, environmentId);

export const fetchEnvironments = async () => {
  environmentsStore.value = {
    ...environmentsStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<EnvironmentIdentity[]>("widgets/environments.json", { bustCache: true });

    environmentsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };

    currentEnvironment.value = migrateStoredEnvironmentSelection(currentEnvironment.value, res);
  } catch (e) {
    environmentsStore.value = {
      ...environmentsStore.peek(),
      error: e.message,
      loading: false,
    };
  }
};

export const fetchTestEnvGroup = async (id: string) => {
  if (testEnvGroupsStore.peek().data[id]) {
    return;
  }

  testEnvGroupsStore.value = {
    ...testEnvGroupsStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TestEnvGroup | undefined>(`data/test-env-groups/${id}.json`);

    testEnvGroupsStore.value = {
      data: {
        ...testEnvGroupsStore.peek().data,
        [id]: res,
      },
      error: undefined,
      loading: false,
    };
  } catch (e) {
    testEnvGroupsStore.value = {
      ...testEnvGroupsStore.peek(),
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
