import type {
  AllureChartsStoreData,
  TestingPyramidChartData,
  TestingPyramidChartOptions,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import {
  emptyStatistic,
  getSuccessRate,
  getSuccessRateTotal,
  incrementStatistic,
  type Statistic,
} from "@allurereport/core-api";

const DEFAULT_LAYERS = ["unit", "integration", "e2e"] as const;

const getPercentage = (value: number, total: number) => {
  if (total === 0 || value === 0) {
    return 0;
  }

  return Math.floor((value / total) * 10000) / 100;
};

export const generateTestingPyramidChart = (
  chartOptions: TestingPyramidChartOptions,
  storeData: AllureChartsStoreData,
): TestingPyramidChartData => {
  const { layers = DEFAULT_LAYERS, title } = chartOptions;
  const { testResults } = storeData;

  const layersMap = new Map<string, string>();

  layers.forEach((layer) => {
    layersMap.set(layer, layer);
    layersMap.set(layer.toLocaleLowerCase(), layer);
  });

  const statsByLayers = new Map<string, Statistic>(layers.map((layer) => [layer, emptyStatistic()]));

  for (const testResult of testResults) {
    const trLayer = testResult.labels.find((label) => label.name === "layer")?.value;

    if (!trLayer) {
      continue;
    }

    const layer = layersMap.get(trLayer.toLocaleLowerCase());

    if (!layer) {
      continue;
    }

    const data = statsByLayers.get(layer)!;

    incrementStatistic(data, testResult.status);
  }

  return {
    type: ChartType.TestingPyramid,
    title,
    data: layers.map((layer) => {
      const data = statsByLayers.get(layer)!;

      return {
        layer,
        testCount: data.total,
        successRate: Math.floor(getSuccessRate(data) * 10000) / 100,
        eligibleCount: getSuccessRateTotal(data),
        percentage: getPercentage(data.total, testResults.length),
      };
    }),
  };
};
