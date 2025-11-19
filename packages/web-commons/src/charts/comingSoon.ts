import type { ComingSoonChartData, ComingSoonChartOptions } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";

export const generateComingSoonChart = (options: ComingSoonChartOptions): ComingSoonChartData => {
  return {
    type: ChartType.ComingSoon,
    title: options.title,
  };
};
