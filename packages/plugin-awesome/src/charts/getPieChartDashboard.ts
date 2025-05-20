import type { Statistic } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { PieChartData, PieChartOptions } from "../charts.js";
import { d3Arc, d3Pie, getPercentage } from "../charts.js";

export const getPieChartDataDashboard = (stats: Statistic, chartOptions: PieChartOptions): PieChartData => {
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
    type: chartOptions.type,
    title: chartOptions?.title,
    slices,
    percentage,
  };
};
