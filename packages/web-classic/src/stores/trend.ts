import { signal } from "@preact/signals";
import { fetchReportJsonData } from "@allurereport/web-commons";
import type { StoreSignalState } from "@/stores/types";
import type { TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";

interface Point {
  x: Date | string | number;
  y: number;
}

interface Slice {
  min: number;
  max: number;
  metadata: { executionId: string };
}

interface TrendResponse {
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, Slice>;
  series: Record<TestStatus, string[]>;
}

interface TrendChartItem {
  id: string;
  data: Point[];
  color: string;
}

interface TrendChartData {
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: Slice[];
}

const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)"
};

export const trendStore = signal<StoreSignalState<TrendChartData>>({
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

    const items = statusesList.reduce<TrendChartItem[]>((acc, status) => {
      const pointIdsByStatus = res.series[status];
      const pointsByStatus = pointIdsByStatus.map(pointId => res.points[pointId]);

      acc.push({
        id: status.charAt(0).toUpperCase() + status.slice(1),
        data: pointsByStatus,
        color: statusColors[status]
      });

      return acc;
    }, [] as TrendChartItem[]);

    trendStore.value = {
      data: { items, slices: Object.values(res.slices), min: res.min, max: res.max },
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
