import type { PieChartValues } from "@allurereport/charts-api";
import { type Statistic } from "@allurereport/core-api";
import { createChartsWithEnvs, fetchReportJsonData, getPieChartValues } from "@allurereport/web-commons";
import type { ChartsResponse, UIChartsDataWithEnvs } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export const pieChartStore = signal<StoreSignalState<PieChartValues>>({
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
    const res = await fetchReportJsonData<Statistic>(env ? `widgets/${env}/statistic.json` : "widgets/statistic.json", {
      bustCache: true,
    });

    pieChartStore.value = {
      data: getPieChartValues(res),
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

export const chartsStore = signal<StoreSignalState<UIChartsDataWithEnvs>>({
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
      data: createChartsWithEnvs(res),
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
