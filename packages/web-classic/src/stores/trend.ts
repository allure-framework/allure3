import { signal } from "@preact/signals";
import { fetchReportJsonData } from "@allurereport/web-commons";
import type { StoreSignalState } from "@/stores/types";
import type { TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";

interface TrendItem {
  buildOrder: number;
  reportName: string;
  data: {
    total: number;
    failed?: number;
    broken?: number;
    passed?: number;
    skipped?: number;
    unknown?: number;
  };
}

interface TrendResponse {
  items: TrendItem[];
}

interface TrendChartItem {
  id: string;
  data: { x: Date | number; y: number }[];
  color: string;
}

interface TrendData {
  data: TrendChartItem[];
}

const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)"
};

export const trendStore = signal<StoreSignalState<TrendData>>({
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
    const res = await fetchReportJsonData<TrendResponse>("widgets/history-trend.json");
    const sortedItems = [...res.items].sort((a, b) => a.buildOrder - b.buildOrder);

    const chartData = statusesList.reduce<TrendChartItem[]>((acc, status) => {
      const hasStatus = sortedItems.some(item => item.data[status]);

      if (hasStatus) {
        acc.push({
          id: status.charAt(0).toUpperCase() + status.slice(1),
          data: sortedItems.map(item => ({
            x: item.buildOrder,
            y: item.data[status] ?? 0
          })),
          color: statusColors[status]
        });
      }

      return acc;
    }, []);

    trendStore.value = {
      data: { data: chartData },
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
