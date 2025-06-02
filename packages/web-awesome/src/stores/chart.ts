import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";
import type { ChartsData, ChartsResponse } from "@/utils/charts";
import { createCharts } from "@/utils/charts";

export const pieChartStore = signal<StoreSignalState<any>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchPieChartData = async (env: string) => {
  pieChartStore.value = {
    ...pieChartStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData(env ? `widgets/${env}/pie_chart.json` : "widgets/pie_chart.json", {
      bustCache: true,
    });

    pieChartStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    pieChartStore.value = {
      error: err.message,
      loading: false,
    };
  }
};

export const chartsStore = signal<StoreSignalState<ChartsData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchChartsData = async () => {
  chartsStore.value = {
    ...chartsStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<ChartsResponse>("widgets/charts.json", { bustCache: true });

    chartsStore.value = {
      data: createCharts(res),
      error: undefined,
      loading: false,
    };
  } catch (err) {
    chartsStore.value = {
      data: undefined,
      error: err.message,
      loading: false,
    };
  }
};
