import {
  type ChartsResponse,
  type UIChartsDataWithEnvs,
  createChartsWithEnvs,
  fetchReportJsonData,
} from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const dashboardStore = signal<StoreSignalState<UIChartsDataWithEnvs>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchDashboardData = async () => {
  dashboardStore.value = {
    ...dashboardStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<ChartsResponse>("widgets/charts.json", { bustCache: true });

    dashboardStore.value = {
      data: createChartsWithEnvs(res),
      error: undefined,
      loading: false,
    };
  } catch (err) {
    dashboardStore.value = {
      data: undefined,
      error: err.message,
      loading: false,
    };
  }
};
