import type { TestStatus, SeverityLevel } from "@allurereport/core-api";
import type { TrendChartData, ChartId } from "@allurereport/core-api/charts/types";
import { statusColors, severityColors } from "./colors";
import { statusesList, severityLevels } from "@allurereport/core-api";

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
  type: "trend";
  dataType: "status" | "severity";
  mode: string;
  title?: string;
  min: number;
  max: number;
  points: Record<string, Point>;
  slices: Record<string, any>;
  series: Record<string, string[]>;
}

export type ChartsResponse = Record<ChartId, ResponseTrendChartData>;

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
  } as TrendChartData;
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