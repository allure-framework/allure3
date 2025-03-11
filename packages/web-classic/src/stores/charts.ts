import { trendStore, fetchTrendData } from "@/stores/trend";
import { pieChartStore, fetchPieChartData } from "@/stores/chart";
import { computed } from "@preact/signals";

export const chartsStore = computed(() => {
    const pieChartValue = pieChartStore.value;
    const trendValue = trendStore.value;

    return {
        error: pieChartValue.error || trendValue.error,
        loading: pieChartValue.loading || trendValue.loading,
        data: {
            pie: pieChartValue.data,
            trends: trendValue.data
        }
    };
});

export const fetchChartsData = () => {
    fetchTrendData();
    fetchPieChartData();
};
