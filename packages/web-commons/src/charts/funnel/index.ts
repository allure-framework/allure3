import type { AllureChartsStoreData, FunnelChartData, FunnelChartOptions } from "@allurereport/charts-api";
import { FunnelChartType } from "@allurereport/charts-api";
import { generateTestingPyramidChart } from "./generateTestingPyramidChart.js";

export const generateFunnelChart = (
  chartOption: FunnelChartOptions,
  storeData: AllureChartsStoreData,
): FunnelChartData => {
  const { dataType } = chartOption;

  switch (dataType) {
    case FunnelChartType.TestingPyramid:
      return generateTestingPyramidChart(chartOption, storeData);
  }
};
