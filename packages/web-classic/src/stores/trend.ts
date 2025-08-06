import { createCharts, fetchReportJsonData } from "@allurereport/web-commons";
import type { ChartsResponse, UIChartsData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const trendStore = signal<StoreSignalState<UIChartsData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchTrendData = async () => {
  trendStore.value = {
    ...trendStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<ChartsResponse>("widgets/charts.json", { bustCache: true });

    trendStore.value = {
      data: createCharts(res),
      error: undefined,
      loading: false,
    };
  } catch (err) {
    trendStore.value = {
      data: undefined,
      error: err.message,
      loading: false,
    };
  }
};
