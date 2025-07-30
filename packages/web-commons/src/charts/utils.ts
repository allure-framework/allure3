import type { TestStatus, SeverityLevel, ChartId, ChartMode, PieSlice } from "@allurereport/core-api";
import { statusesList, severityLevels, ChartType, ChartDataType } from "@allurereport/core-api";
import { statusColors, severityColors } from "./colors.js";
import type { StatusTrendSlice, SeverityTrendSlice } from "../charts.js";

export interface UITrendChartData {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: (StatusTrendSlice | SeverityTrendSlice)[];
  title?: string;
}

export interface Point {
  x: Date | string | number;
  y: number;
}

export interface TrendChartItem {
  id: string;
  data: Point[];
  color: string;
}

export interface ResponseTrendChartData {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, StatusTrendSlice | SeverityTrendSlice>;
  series: Record<string, string[]>;
}

export type ChartsResponse = Record<ChartId, ResponseTrendChartData>;

export interface ResponsePieChartData {
  type: ChartType.Pie;
  title?: string;
  percentage: number;
  slices: PieSlice[];
}

export type UIPieChartData = ResponsePieChartData;

export type ChartsData = Record<ChartId, ResponseTrendChartData | ResponsePieChartData>;

export type UIChartData = UITrendChartData | UIPieChartData;

export const createTrendChartData = <T extends TestStatus | SeverityLevel>(
  getChart: () => ResponseTrendChartData | undefined,
  getGroups: () => readonly T[],
  getColor: (group: T) => string,
): UITrendChartData | undefined => {
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
  } as UITrendChartData;
};

export const createStatusTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

export const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

export const createaTrendChartData = (
  chartId: string,
  chartData: ResponseTrendChartData,
  res: ChartsData,
): UITrendChartData | undefined => {
  if (chartData.dataType === ChartDataType.Status) {
    return createStatusTrendChartData(chartId, res as ChartsResponse);
  } else if (chartData.dataType === ChartDataType.Severity) {
    return createSeverityTrendChartData(chartId, res as ChartsResponse);
  }
};

export const createCharts = (res: ChartsData): Record<ChartId, UIChartData> => {
  return Object.entries(res).reduce((acc, [chartId, chart]) => {
    if (chart.type === ChartType.Trend) {
      const chartData = createaTrendChartData(chartId, chart, res);
      if (chartData) {
        acc[chartId] = chartData;
      }
    } else if (chart.type === ChartType.Pie) {
      acc[chartId] = chart;
    }
    return acc;
  }, {} as Record<ChartId, UIChartData>);
};
