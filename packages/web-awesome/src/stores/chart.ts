import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

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
    const res = await fetchReportJsonData(env ? `widgets/${env}/pie_chart.json` : "widgets/pie_chart.json");

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
