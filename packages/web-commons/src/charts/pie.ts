import type { PieChartData, PieChartOptions } from "@allurereport/charts-api";
import type { Statistic } from "@allurereport/core-api";
import { getPieChartValues } from "./d3pie.js";

export const getPieChartData = (stats: Statistic, chartOptions: PieChartOptions): PieChartData => ({
  type: chartOptions.type,
  title: chartOptions?.title,
  ...getPieChartValues(stats),
});

export const generatePieChart = (
  options: PieChartOptions,
  stores: {
    statistic: Statistic;
  },
): PieChartData => {
  const { statistic } = stores;

  return getPieChartData(statistic, options);
};
