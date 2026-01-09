import { type TestEnvGroup } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const testEnvGroupsStore = signal<StoreSignalState<Record<string, TestEnvGroup>>>({
  loading: false,
  error: undefined,
  data: {},
});

export const fetchTestEnvGroup = async (id: string) => {
  if (testEnvGroupsStore.value.data[id]) {
    return;
  }

  testEnvGroupsStore.value = {
    ...testEnvGroupsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TestEnvGroup | undefined>(`data/test-env-groups/${id}.json`);

    testEnvGroupsStore.value = {
      data: {
        ...testEnvGroupsStore.value.data,
        [id]: res,
      },
      error: undefined,
      loading: false,
    };
  } catch (e) {
    testEnvGroupsStore.value = {
      ...testEnvGroupsStore.value,
      error: e.message,
      loading: false,
    };
  }
};
