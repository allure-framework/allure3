import type {
  SeverityLevel,
  TestStatus,
  TrendPoint,
  TrendSlice,
  TrendChartData as CoreTrendChartData,
  PieChartData as CorePieChartData,
  ChartId,
  ChartMode,
  PieChartData
} from "@allurereport/core-api";
import { severityLevels, statusesList, ChartDataType, ChartType } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

interface TrendChartItem {
  id: string;
  data: TrendPoint[];
  color: string;
}

export interface TrendChartData {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: TrendSlice[];
  title?: string;
}


export type ChartData = TrendChartData | PieChartData;

type ChartsResponse = Partial<Record<ChartId, CoreTrendChartData | CorePieChartData>>;

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

const createTrendChartData = <T extends TestStatus | SeverityLevel>(
  getChart: () => CoreTrendChartData | undefined,
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
    () => res[chartId] && res[chartId].type === ChartType.Trend ? res[chartId] as CoreTrendChartData : undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): TrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] && res[chartId].type === ChartType.Trend ? res[chartId] as CoreTrendChartData : undefined,
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

export const dashboardStore = signal<StoreSignalState<ChartsData>>({
  loading: true,
  error: undefined,
  data: undefined,
});

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
