import { computed } from "@preact/signals";
import { fetchPieChartData, pieChartStore } from "@/stores/chart";
import { fetchSummaryData, summaryStore } from "@/stores/summary";
import { fetchTrendData, trendStore } from "@/stores/trend";

export const chartsStore = computed(() => {
  const pieChartValue = pieChartStore.value;
  const trendValue = trendStore.value;
  const summaryValue = summaryStore.value;

  return {
    error: pieChartValue.error || summaryValue.error,
    loading: pieChartValue.loading || summaryValue.loading,
    data: {
      pie: pieChartValue.data,
      trends: trendValue.data,
      summary: summaryValue.data,
    },
  };
});

export const fetchChartsData = () => {
  fetchTrendData();
  fetchPieChartData();
  fetchSummaryData();
};
