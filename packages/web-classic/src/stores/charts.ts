import { computed } from "@preact/signals";
import { fetchPieChartData, pieChartStore } from "@/stores/chart";
import { fetchTrendData, trendStore } from "@/stores/trend";

export const chartsStore = computed(() => {
  const pieChartValue = pieChartStore.value;
  const trendValue = trendStore.value;

  return {
    error: pieChartValue.error || trendValue.error,
    loading: pieChartValue.loading || trendValue.loading,
    data: {
      pie: pieChartValue.data,
      trends: trendValue.data,
    },
  };
});

export const fetchChartsData = () => {
  fetchTrendData();
  fetchPieChartData();
};
