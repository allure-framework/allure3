import { signal } from "@preact/signals";
import { fetchReportJsonData } from "@allurereport/web-commons";
import type { StoreSignalState } from "@/stores/types";
import type { TestStatus, SeverityLevel } from "@allurereport/core-api";
import { statusesList, severityLevels } from "@allurereport/core-api";

interface Point {
  x: Date | string | number;
  y: number;
}

interface Slice {
  min: number;
  max: number;
  metadata: { executionId: string };
}

type ChartType = "status" | "severity";

interface ChartData {
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, Slice>;
  series: Record<TestStatus | SeverityLevel, string[]>;
};

interface TrendResponse {
  charts: Partial<Record<ChartType, ChartData>>;
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

interface TrendData {
  charts: Partial<Record<ChartType, TrendChartData>>;
}

const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)"
};

const severityColors: Record<SeverityLevel, string> = {
  blocker: "var(--bg-support-capella)",
  critical: "var(--bg-support-atlas)",
  normal: "var(--bg-support-castor)",
  minor: "var(--bg-support-rau)",
  trivial: "var(--bg-support-skat)"
};

export const trendStore = signal<StoreSignalState<TrendData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

/**
 * Helper function to create chart data for different chart types
 *
 * @param getChart - Function to get the chart data
 * @param getGroups - Function to get the groups
 * @param getColor - Function to get the color
 * @returns TrendChartData or undefined if the chart data is not available
 */
const createChartData = <T extends TestStatus | SeverityLevel>(
  getChart: () => ChartData | undefined,
  getGroups: () => T[],
  getColor: (group: T) => string
): TrendChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  const items = getGroups().reduce((acc, group) => {
    const pointsByGroupBy = chart.series[group]?.map(pointId => ({
      x: chart.points[pointId].x,
      y: chart.points[pointId].y
    })) ?? [];

    if (pointsByGroupBy.length) {
      acc.push({
        id: group.charAt(0).toUpperCase() + group.slice(1),
        data: pointsByGroupBy,
        color: getColor(group)
      });
    }

    return acc;
  }, [] as TrendChartItem[]);

  return {
    items,
    slices: Object.values(chart.slices),
    min: chart.min,
    max: chart.max
  };
};

const createStatusChartData = (res: TrendResponse): TrendChartData | undefined => createChartData(() => res.charts.status, () => statusesList, (status) => statusColors[status]);
const createSeverityChartData = (res: TrendResponse): TrendChartData | undefined => createChartData(() => res.charts.severity, () => severityLevels, (severity) => severityColors[severity]);

const makeCharts = (res: TrendResponse): TrendData["charts"] => ({
  status: res.charts.status ? createStatusChartData(res) : undefined,
  severity: res.charts.severity ? createSeverityChartData(res) : undefined,
});

export const fetchTrendData = async () => {
  trendStore.value = {
    ...trendStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TrendResponse>("widgets/history-trend.json");

    trendStore.value = {
      data: {
        charts: makeCharts(res)
      },
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
