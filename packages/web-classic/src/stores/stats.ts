import type { Statistic } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const statsStore = signal<StoreSignalState<Statistic>>({
  loading: true,
  error: undefined,
  data: {
    total: 0,
  },
});

export const fetchStats = async () => {
  statsStore.value = {
    ...statsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<Statistic>("widgets/allure_statistic.json", { bustCache: true });

    statsStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    statsStore.value = {
      data: { total: 0 },
      error: err.message,
      loading: false,
    };
  }
};
