import { DEFAULT_ENVIRONMENT, type EnvironmentIdentity, type TestEnvGroup } from "@allurereport/core-api";
import {
  environmentNameById as resolveEnvironmentNameById,
  errorMessageFromUnknown,
  fetchReportJsonData,
  migrateStoredEnvironmentSelection,
  normalizeEnvironmentsWidget,
} from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";

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

/**
 * Environment id of the bucket holding the report data which isn't bound to an environment.
 *
 * Such data is indexed under the default environment, so that bucket is shared by every environment
 * - unless the report declares `default` as an environment of its own, in which case the bucket
 * holds entries specific to it and there is nothing shared, hence `null`.
 */
export const sharedEnvironmentId = computed<string | null>(() =>
  environmentsStore.value.data.some(({ id, configured }) => id === DEFAULT_ENVIRONMENT && configured)
    ? null
    : DEFAULT_ENVIRONMENT,
);

export const fetchEnvironments = async () => {
  environmentsStore.value = {
    ...environmentsStore.peek(),
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
      ...environmentsStore.peek(),
      error: errorMessageFromUnknown(e),
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
      error: errorMessageFromUnknown(e),
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
