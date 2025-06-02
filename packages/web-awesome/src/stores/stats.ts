import type { Statistic } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";
import type { AwesomeTree } from "../../types";

export const reportStatsStore = signal<StoreSignalState<Statistic>>({
  loading: true,
  error: undefined,
  data: {
    total: 0,
  },
});

export const statsByEnvStore = signal<StoreSignalState<Record<string, Statistic>>>({
  loading: true,
  error: undefined,
  data: {},
});

export const fetchReportStats = async () => {
  reportStatsStore.value = {
    ...reportStatsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<Statistic>("widgets/statistic.json", { bustCache: true });

    reportStatsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    reportStatsStore.value = {
      data: { total: 0 },
      error: err.message,
      loading: false,
    };
  }
};

export const fetchEnvStats = async (envs: string[]) => {
  const envsToFetch = envs.filter((env) => !statsByEnvStore.value.data?.[env]);

  // all envs have already been fetched
  if (envsToFetch.length === 0) {
    return;
  }

  statsByEnvStore.value = {
    ...statsByEnvStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await Promise.all(
      envsToFetch.map((env) => fetchReportJsonData<AwesomeTree>(`widgets/${env}/statistic.json`, { bustCache: true })),
    );

    statsByEnvStore.value = {
      data: envs.reduce((acc, env, index) => {
        return {
          ...acc,
          [env]: data[index],
        };
      }, {}),
      loading: false,
      error: undefined,
    };
  } catch (err) {
    statsByEnvStore.value = {
      ...statsByEnvStore.value,
      error: err.message,
      loading: false,
    };
  }
};
