import type { Statistic, TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";

export type TestResultSlice = {
  status: TestStatus;
  count: number;
};

export type TestResultChartData = {
  percentage: number;
  slices: TestResultSlice[];
};

export type TrendItem = {
  buildOrder: number;
  reportName: string;
  data: Statistic;
};

export type TrendData = {
  items: TrendItem[];
};

export type TrendItemMetadata = {
  createdAt: number;
  updatedAt: number;
};

export type TrendPointId = string; // TestRunId

export type TrendPoint = {
  id: TrendPointId; // x
  value: number; // y
  metadata: TrendItemMetadata;
};

export type TrendChartData = {
  points: Record<TrendPointId, TrendPoint>;
  series: Record<TestStatus, TrendPointId[]>;
};

export const d3Arc = arc<PieArcDatum<TestResultSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<TestResultSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getPieChartData = (stats: Statistic): TestResultChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData.map((arcData) => ({
    d: d3Arc(arcData),
    ...arcData.data,
  }));
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};

export const getTrendData = (stats: Statistic, reportName: string, buildOrder: number): TrendItem => {
  return {
    buildOrder,
    reportName,
    data: stats,
  };
};
