import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { StoreSignalState } from "@/stores/types";

export const pieChartStore = signal<StoreSignalState<any>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchPieChartData = async () => {
  pieChartStore.value = {
    ...pieChartStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData("widgets/allure_pie_chart.json", { bustCache: true });

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
