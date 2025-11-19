import type { AllureChartsStoreData, BarChartData, BarChartOptions, BarGroup } from "@allurereport/charts-api";
import {
  BarChartType,
  BarGroupMode,
  ChartMode,
  ChartType,
  DEFAULT_CHART_HISTORY_LIMIT,
} from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "../chart-utils.js";

const generateDataPoint = (testResults: Pick<TestResult, "status">[], name: string): BarGroup<string, string> => {
  // Count tests by status
  let failed = 0;
  let broken = 0;
  let skipped = 0;
  let unknown = 0;

  for (const testResult of testResults) {
    switch (testResult.status) {
      case "failed":
        failed++;
        break;
      case "broken":
        broken++;
        break;
      case "skipped":
        skipped++;
        break;
      case "unknown":
        unknown++;
        break;
    }
  }

  // Calculate total tests
  const totalTests = failed + broken + skipped + unknown;

  // Calculate percentages
  const failedPercent = totalTests > 0 ? failed / totalTests : 0;
  const brokenPercent = totalTests > 0 ? broken / totalTests : 0;
  const skippedPercent = totalTests > 0 ? skipped / totalTests : 0;
  const unknownPercent = totalTests > 0 ? unknown / totalTests : 0;

  // For diverging chart: left side (negative) and right side (positive)
  const dataPoint: BarGroup<string, string> = {
    groupId: name,
  } as BarGroup<string, string>;

  // Add dynamic properties (multiply by 100 and round to convert to percentages)
  (dataPoint as any).failed = Math.round(-failedPercent * 100); // Negative values for left side
  (dataPoint as any).broken = Math.round(-brokenPercent * 100);
  (dataPoint as any).skipped = Math.round(skippedPercent * 100); // Positive values for right side
  (dataPoint as any).unknown = Math.round(unknownPercent * 100);

  return dataPoint;
};

export const generateBarChartFbsuAgePyramid = (
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
): BarChartData | undefined => {
  const { title, limit = DEFAULT_CHART_HISTORY_LIMIT } = options;
  const { historyDataPoints, testResults } = storeData;

  // Apply limit to history points if specified
  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit);

  const chartData: BarGroup<string, string>[] = [
    generateDataPoint(testResults, "current"),
    ...limitedHistoryPoints.map((historyPoint, index) =>
      generateDataPoint(
        Object.values(historyPoint.testResults) as Pick<TestResult, "status">[],
        // Just following convention from other charts
        `Point ${index + 1}`,
      ),
    ),
  ];

  return {
    data: chartData,
    type: ChartType.Bar,
    dataType: BarChartType.FbsuAgePyramid,
    mode: ChartMode.Diverging,
    title,
    keys: ["failed", "broken", "skipped", "unknown"],
    groupMode: BarGroupMode.Stacked,
    indexBy: "groupId",
    xAxisConfig: {
      legend: "Percentage of Tests",
    },
    yAxisConfig: {
      legend: "",
      format: "preserve",
      enabled: false,
      domain: [-100, 100],
    },
    layout: "horizontal",
  };
};
