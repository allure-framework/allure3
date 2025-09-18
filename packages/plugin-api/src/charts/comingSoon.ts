import { ChartType } from "@allurereport/core-api";
import type { ComingSoonChartData, ComingSoonChartOptions } from "../charts.js";

export const generateComingSoonChart = (options: ComingSoonChartOptions): ComingSoonChartData => {
  return {
    type: ChartType.ComingSoon,
    title: options.title,
  };
};
