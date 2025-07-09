import { type SeverityLevel, type TestStatus, severityLevels, statusesList } from "@allurereport/core-api";
import { ChartDataType, type ChartId, type ChartMode, ChartType } from "@allurereport/web-commons";

export interface Point {
  x: Date | string | number;
  y: number;
}

export interface Slice {
  min: number;
  max: number;
  metadata: { executionId: string };
}

export type SeriesType = TestStatus | SeverityLevel;

interface ResponseTrendChartData<GroupBy extends string = SeriesType> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, Slice>;
  series: Record<GroupBy, string[]>;
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

export interface PieSlice {
  status: TestStatus;
  count: number;
  d: string | null;
}

export interface ResponsePieChartData {
  type: ChartType.Pie;
  title?: string;
  percentage: number;
  slices: PieSlice[];
}

export type PieChartData = ResponsePieChartData;
export type ChartData = TrendChartData | PieChartData;
export type ChartsResponse = Partial<Record<ChartId, ResponseTrendChartData | ResponsePieChartData>>;
export type ChartsData = Record<ChartId, ChartData>;

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

/**
 * Helper function to create chart data for different chart types
 *
 * @param getChart - Function to get the chart data
 * @param getGroups - Function to get the groups
 * @param getColor - Function to get the color
 * @returns TrendChartData or undefined if the chart data is not available
 */
export const createTrendChartData = <T extends TestStatus | SeverityLevel>(
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
      chart.series[group]?.map((pointId) => {
        const point = chart.points[pointId];

        return {
          x: point.x,
          y: point.y,
        };
      }) ?? [];

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

export const createStatusTrendChartData = (chartId: ChartId, res: ChartsResponse): TrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

export const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): TrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

export const createaTrendChartData = (
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

export const createCharts = (res: ChartsResponse): ChartsData => {
  return Object.entries(res).reduce((acc, [chartId, chart]) => {
    if (chart.type === ChartType.Trend) {
      acc[chartId] = createaTrendChartData(chartId, chart, res);
    } else if (chart.type === ChartType.Pie) {
      acc[chartId] = chart;
    }

    return acc;
  }, {} as ChartsData);
};
