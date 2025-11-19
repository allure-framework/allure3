import type { AllureChartsStoreData, BarChartData, BarChartOptions } from "@allurereport/charts-api";
import { BarChartType, BarGroupMode, ChartMode, ChartType } from "@allurereport/charts-api";

export const generateStabilityRateDistribution = (
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
): BarChartData | undefined => {
  const { title, threshold = 90 } = options;
  const { testResults } = storeData;

  const testResultsByFeature = new Map<string, { passed: number; total: number }>();

  for (const testResult of testResults) {
    const feature = testResult.labels.find((label) => label.name === "feature")?.value;

    if (!feature) {
      continue;
    }

    if (!testResultsByFeature.has(feature)) {
      testResultsByFeature.set(feature, { passed: 0, total: 0 });
    }

    testResultsByFeature.get(feature)!.total++;

    if (testResult.status === "passed") {
      testResultsByFeature.get(feature)!.passed++;
    }
  }

  return {
    data: Array.from(testResultsByFeature.entries()).map(
      ([feature, { passed, total }]) =>
        ({
          groupId: feature,
          stabilityRate: Math.floor((passed / total) * 10000) / 100,
        }) as any,
    ),
    type: ChartType.Bar,
    dataType: BarChartType.StabilityRateDistribution,
    mode: ChartMode.Raw,
    title,
    keys: ["stabilityRate"],
    groupMode: BarGroupMode.Grouped,
    indexBy: "groupId",
    yAxisConfig: {
      legend: "Stability Rate",
      format: " >-.0f",
      tickValues: 5,
      domain: [0, 100],
    },
    xAxisConfig: {
      legend: "Features",
    },
    threshold,
  };
};
