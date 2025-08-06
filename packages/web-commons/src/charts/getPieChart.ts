import type { PieChartData, PieChartOptions, Statistic, PieSlice } from "@allurereport/core-api";
import { statusesList, getPercentage } from "@allurereport/core-api";
import { d3Arc, d3Pie } from "../charts.js";

export type PieChartValues = {
  percentage: number;
  slices: PieSlice[];
};

export const getPieChartValues = (stats: Statistic): PieChartValues => {
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
    .filter(item => item !== null);
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};

export const getPieChartData = (stats: Statistic, chartOptions: PieChartOptions): PieChartData => ({
  type: chartOptions.type,
  title: chartOptions?.title,
  ...getPieChartValues(stats),
});
