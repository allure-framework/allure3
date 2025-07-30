import type { Statistic, TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import { d3Arc, d3Pie, getPercentage } from "../charts.js";

export type TestResultSlice = {
  status: TestStatus;
  count: number;
  d: string;
};

export type TestResultChartData = {
  percentage: number;
  slices: TestResultSlice[];
};

export const isTestResultSlice = (slice: TestResultSlice | null): slice is TestResultSlice => {
  return slice !== null;
};

export const getPieChartData = (stats: Statistic): TestResultChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData
    .map((arcData) => {
      const d = d3Arc(arcData);

      if (!d) {
        return null;
      }

      return {
        d,
        ...arcData.data,
      };
    })
    .filter(isTestResultSlice);
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};
