import type { Statistic } from "@allurereport/core-api";
import { getPieChartValues } from "@allurereport/core-api";
import type { PieChartData, PieChartOptions } from "../charts.js";

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
