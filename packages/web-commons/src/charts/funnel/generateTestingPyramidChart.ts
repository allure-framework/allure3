import type { AllureChartsStoreData, FunnelChartData, FunnelChartOptions } from "@allurereport/charts-api";
import { ChartType, FunnelChartType } from "@allurereport/charts-api";

type TestingPyramidChartData = {
  layer: string;
  testCount: number;
  successRate: number;
  percentage: number;
};

const DEFAULT_LAYERS = ["unit", "integration", "e2e"] as const;

const getPercentage = (value: number, total: number) => {
  if (total === 0 || value === 0) {
    return 0;
  }

  return Math.floor((value / total) * 10000) / 100;
};

export const generateTestingPyramidChart = (
  chartOptions: FunnelChartOptions,
  storeData: AllureChartsStoreData,
): FunnelChartData => {
  const { layers = DEFAULT_LAYERS, title } = chartOptions;
  const { testResults } = storeData;

  const layersMap = new Map<string, string>();

  layers.forEach((layer) => {
    layersMap.set(layer, layer);
    layersMap.set(layer.toLocaleLowerCase(), layer);
  });

  const statsByLayers = new Map<
    string,
    {
      passed: number;
      total: number;
    }
  >();

  layers.forEach((layer) => {
    statsByLayers.set(layer, {
      passed: 0,
      total: 0,
    });
  });

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

    data.total++;

    if (testResult.status === "passed") {
      data.passed++;
    }
  }

  return {
    type: ChartType.Funnel,
    dataType: FunnelChartType.TestingPyramid,
    title,
    data: layers.map((layer) => {
      const data = statsByLayers.get(layer)!;

      return {
        layer,
        testCount: data.total,
        successRate: getPercentage(data.passed, data.total),
        percentage: getPercentage(data.total, testResults.length),
      } as TestingPyramidChartData;
    }),
  };
};
