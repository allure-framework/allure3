import type { SeverityLevel, TestStatus } from "@allurereport/core-api";
import { severityLevels, statusesList } from "@allurereport/core-api";
import { ChartDataType, type ChartId, type ChartMode, ChartType, fetchReportJsonData } from "@allurereport/web-commons";
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

interface ResponseTrendChartData {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, Slice>;
  series: Record<TestStatus | SeverityLevel, string[]>;
}

interface TrendChartItem {
  id: string;
  data: Point[];
  color: string;
}

export interface TrendChartData {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: Slice[];
  title?: string;
}

interface PieSlice {
  status: TestStatus;
  count: number;
  d: string | null;
}

interface ResponsePieChartData {
  type: ChartType.Pie;
  title?: string;
  percentage: number;
  slices: PieSlice[];
}

export type PieChartData = ResponsePieChartData;

export type ChartData = TrendChartData | PieChartData;

type ChartsResponse = Partial<Record<ChartId, ResponseTrendChartData | ResponsePieChartData>>;

type ChartsData = Record<ChartId, ChartData>;

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

export const dashboardStore = signal<StoreSignalState<ChartsData>>({
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
const createTrendChartData = <T extends TestStatus | SeverityLevel>(
  getChart: () => ResponseTrendChartData | undefined,
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
    dataType: chart.dataType,
    mode: chart.mode,
    title: chart.title,
    items,
    slices: Object.values(chart.slices),
    min: chart.min,
    max: chart.max,
  };
};

const createStatusTrendChartData = (chartId: ChartId, res: ChartsResponse): TrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );
const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): TrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

const createaTrendChartData = (
  chartId: string,
  chartData: ResponseTrendChartData,
  res: ChartsResponse,
): TrendChartData | undefined => {
  if (chartData.dataType === ChartDataType.Status) {
    return createStatusTrendChartData(chartId, res);
  } else if (chartData.dataType === ChartDataType.Severity) {
    return createSeverityTrendChartData(chartId, res);
  }
};

const createCharts = (res: ChartsResponse): ChartsData => {
  return Object.entries(res).reduce((acc, [chartId, chart]) => {
    if (chart.type === ChartType.Trend) {
      acc[chartId] = createaTrendChartData(chartId, chart, res);
    } else if (chart.type === ChartType.Pie) {
      acc[chartId] = chart;
    }

    return acc;
  }, {} as ChartsData);
};

export const fetchDashboardData = async () => {
  dashboardStore.value = {
    ...dashboardStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<ChartsResponse>("widgets/charts.json", { bustCache: true });

    dashboardStore.value = {
      data: createCharts(res),
      error: undefined,
      loading: false,
    };
  } catch (err) {
    dashboardStore.value = {
      data: undefined,
      error: err.message,
      loading: false,
    };
  }
};
