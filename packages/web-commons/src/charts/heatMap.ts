import type {
  AllureChartsStoreData,
  HeatMapChartData,
  HeatMapChartOptions,
  HeatMapDataAccessor,
} from "@allurereport/charts-api";
import { problemsDistributionHeatMapAccessor } from "./accessors/problemsDistributionHeatMap.js";

export const generateHeatMapChartGeneric = <T extends Record<string, unknown>>(
  options: HeatMapChartOptions,
  storeData: AllureChartsStoreData,
  dataAccessor: HeatMapDataAccessor<T>,
): HeatMapChartData | undefined => ({
  type: options.type,
  title: options.title,
  data: dataAccessor.getHeatMap(storeData),
});

export const generateHeatMapChart = (
  options: HeatMapChartOptions,
  storeData: AllureChartsStoreData,
): HeatMapChartData | undefined => {
  return generateHeatMapChartGeneric(options, storeData, problemsDistributionHeatMapAccessor);
};
