import { type AllureChartsStoreData, ChartType, type CurrentStatusChartOptions } from "@allurereport/charts-api";
import type { CurrentStatusChartData } from "./types.js";

export const generateCurrentStatusChart = (
  options: CurrentStatusChartOptions,
  storeData: AllureChartsStoreData,
): CurrentStatusChartData => {
  return {
    type: ChartType.CurrentStatus,
    title: options.title,
    data: storeData.statistic,
    statuses: options.statuses,
    metric: options.metric,
  };
};
