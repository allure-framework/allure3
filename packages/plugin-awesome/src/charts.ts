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

// Type aliases for meaningful string keys
export type TrendPointId = string;
export type TrendSliceId = string;

export type BaseTrendItemMetadata = {
  // Unique identifier for this test execution instance (e.g. "build-2023-05-12-001")
  executionId: string;
  // Human readable name for this test execution (e.g. "Nightly Build #123" or "Sprint 45 Regression")
  executionName: string;
};

export type StatusTrendSliceMetadata = BaseTrendItemMetadata;

export type TrendPoint = {
  x: string;
  y: number;
};

export type StatusTrendSlice = {
  // Minimum value on Y-axis of the trend chart slice
  min: number;
  // Maximum value on Y-axis of the trend chart slice
  max: number;
  // Metadata about this test execution
  metadata: StatusTrendSliceMetadata;
};

export type StatusTrendChartData = {
  // Points for all series
  points: Record<TrendPointId, TrendPoint>;
  // Slices for all series
  slices: Record<TrendSliceId, StatusTrendSlice>;
  // Grouping by series, containing array of point IDs for each status
  series: Record<TestStatus, TrendPointId[]>;
  // Minimum value on Y-axis of the trend chart
  min: number;
  // Maximum value on Y-axis of the trend chart
  max: number;
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

/**
 * Transform statistic to trend data for a single history point
 *
 * @param stats - Statistic object
 * @param reportName - Name of the report
 * @param buildOrder - Order of the build
 * @returns StatusTrendChartData object
 */
export const getTrendData = (statistic: Statistic, reportName: string, executionOrder: number): StatusTrendChartData => {
  const points: Record<TrendPointId, TrendPoint> = {};
  const slices: Record<TrendSliceId, StatusTrendSlice> = {};
  const series: Record<TestStatus, TrendPointId[]> = statusesList.reduce((acc, status) => ({
    ...acc,
    [status]: [],
  }), {} as Record<TestStatus, TrendPointId[]>);

  const executionId = `execution-${executionOrder}`;

  // Create points and populate series
  statusesList.forEach(status => {
    const pointId = `${executionId}-${status}`; // Some unique identifier across all points

    if (statistic[status]) {
      points[pointId] = {
        x: executionId,
        y: statistic[status] ?? 0,
      };

      series[status].push(pointId);
    }
  });

  // Create slice
  // Calculate min and max values from points
  const values = Object.values(points).map(point => point.y);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  slices[executionId] = {
    min,
    max,
    metadata: {
      executionId,
      executionName: reportName,
    }
  };

  return {
    points,
    slices,
    series,
    min,
    max,
  };
};
