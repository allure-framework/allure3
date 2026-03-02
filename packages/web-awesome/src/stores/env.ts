import { type TestEnvGroup } from "@allurereport/core-api";
import { clearReportClientCache, fetchReportJsonData } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";

export type EnvironmentItem = { id: string; name: string };

export const environmentsStore = signal<StoreSignalState<EnvironmentItem[]>>({
  loading: false,
  error: undefined,
  data: [],
});

/** Map env id -> display name for Tree/EnvironmentPicker. Use this for consistent lookup. */
export const envDisplayNameMap = computed(() => {
  const data = environmentsStore.value.data ?? [];
  return Object.fromEntries(data.map((e) => [e.id, e.name ?? e.id]));
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

export const fetchEnvironments = async () => {
  // Ensure we use current apiBaseUrl/launchId (e.g. after navigating to report?launch_id=...)
  clearReportClientCache();
  environmentsStore.value = {
    ...environmentsStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<EnvironmentItem[] | string[]>("widgets/environments.json", {
      bustCache: true,
    });

    // Normalize: API returns {id, name}[], static report returns string[]
    const data: EnvironmentItem[] = Array.isArray(res)
      ? res.map((e) =>
          typeof e === "string" ? { id: e, name: e } : { id: e.id, name: e.name ?? e.id }
        )
      : [];

    environmentsStore.value = {
      data,
      error: undefined,
      loading: false,
    };
    // Don't auto-select first child for parent launch — keep "All" so parent metadata is shown
    // Reset currentEnvironment if it's no longer in the new list (e.g. navigated to different launch)
    const ids = data.map((e) => e.id);
    if (currentEnvironment.peek() && !ids.includes(currentEnvironment.peek()!)) {
      currentEnvironment.value = "";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    environmentsStore.value = {
      ...environmentsStore.peek(),
      error: msg,
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
    const msg = e instanceof Error ? e.message : String(e);
    testEnvGroupsStore.value = {
      ...testEnvGroupsStore.peek(),
      error: msg,
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
