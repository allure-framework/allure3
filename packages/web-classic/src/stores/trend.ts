import type { SeverityLevel, TestStatus } from "@allurereport/core-api";
import { severityLevels, statusesList } from "@allurereport/core-api";
import { type ChartId, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

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
  type: ChartType;
  title?: string;
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, Slice>;
  series: Record<TestStatus | SeverityLevel, string[]>;
}

interface TrendResponse {
  charts: Partial<Record<ChartId, ChartData>>;
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
  type: ChartType;
  title?: string;
}

interface TrendData {
  charts: Partial<Record<ChartId, TrendChartData>>;
}

const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)",
};

const severityColors: Record<SeverityLevel, string> = {
  blocker: "var(--bg-support-capella)",
  critical: "var(--bg-support-atlas)",
  normal: "var(--bg-support-castor)",
  minor: "var(--bg-support-rau)",
  trivial: "var(--bg-support-skat)",
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
  getGroups: () => readonly T[],
  getColor: (group: T) => string,
): TrendChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  const items = getGroups().reduce((acc, group) => {
    const pointsByGroupBy =
      chart.series[group]?.map((pointId) => ({
        x: chart.points[pointId].x,
        y: chart.points[pointId].y,
      })) ?? [];

    if (pointsByGroupBy.length) {
      acc.push({
        id: group.charAt(0).toUpperCase() + group.slice(1),
        data: pointsByGroupBy,
        color: getColor(group),
      });
    }

    return acc;
  }, [] as TrendChartItem[]);

  return {
    type: chart.type,
    title: chart.title,
    items,
    slices: Object.values(chart.slices),
    min: chart.min,
    max: chart.max,
  };
};

const createStatusChartData = (chartId: ChartId, res: TrendResponse): TrendChartData | undefined =>
  createChartData(
    () => res.charts[chartId],
    () => statusesList,
    (status) => statusColors[status],
  );
const createSeverityChartData = (chartId: ChartId, res: TrendResponse): TrendChartData | undefined =>
  createChartData(
    () => res.charts[chartId],
    () => severityLevels,
    (severity) => severityColors[severity],
  );

const makeCharts = (res: TrendResponse): TrendData["charts"] => {
  return Object.entries(res.charts).reduce(
    (acc, [chartId, chart]) => {
      const { type } = chart;

      if (type === "status") {
        acc[chartId] = createStatusChartData(chartId, res);
      } else if (type === "severity") {
        acc[chartId] = createSeverityChartData(chartId, res);
      }

      return acc;
    },
    {} as Record<ChartId, TrendChartData>,
  );
};

export const fetchTrendData = async () => {
  trendStore.value = {
    ...trendStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TrendResponse>("widgets/history-trend.json", { bustCache: true });

    trendStore.value = {
      data: {
        charts: makeCharts(res),
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
