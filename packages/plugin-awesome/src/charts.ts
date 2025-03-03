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

// Type aliases for meaningful string keys
export type TrendPointId = string; // X-axis value

export type BaseTrendItemMetadata = {
  // Unique identifier for this test execution instance (e.g. "build-2023-05-12-001")
  runExecutionId: string;
  // Human readable name for this test execution (e.g. "Nightly Build #123" or "Sprint 45 Regression")
  runExecutionName: string;
};

export type TrendItemMetadata = BaseTrendItemMetadata & {
  // Unix timestamp when this test execution started (e.g. 1683900000000)
  startTime: number;
  // Unix timestamp when this test execution completed (e.g. 1683900120000)
  endTime: number;
};

export type StatusTrendPoint = {
  // Y-axis value
  value: number;
  // Metadata about this test execution
  metadata: TrendItemMetadata;
};

export type StatusTrendChartData = {
  // Raw values for all series containing x (id) and y (value) coordinates
  points: Record<TrendPointId, StatusTrendPoint>;
  // Grouping by series, containing array of point IDs for each status
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
