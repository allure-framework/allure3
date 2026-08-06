import type { PieChartValues } from "@allurereport/charts-api";
import type { ChartsResponse, UIChartsDataWithEnvs } from "@allurereport/web-commons";
import { createChartsWithEnvs, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export const pieChartStore = signal<StoreSignalState<PieChartValues>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchPieChartData = async (env: string) => {
  pieChartStore.value = {
    ...pieChartStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<PieChartValues>(
      env ? `widgets/${env}/pie_chart.json` : "widgets/pie_chart.json",
      {
        bustCache: true,
      },
    );

    pieChartStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    pieChartStore.value = {
      error: errorMessageFromUnknown(err),
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
    ...chartsStore.peek(),
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
