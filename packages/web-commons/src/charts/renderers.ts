import { ChartType } from "@allurereport/charts-api";

export type ChartRenderer = "pie" | "bar" | "treemap" | "heatmap" | "funnel" | "run-trend";

export const chartRenderers: Record<ChartType, ChartRenderer> = {
  [ChartType.CurrentStatus]: "pie",
  [ChartType.StatusDynamics]: "bar",
  [ChartType.StatusTransitions]: "bar",
  [ChartType.Durations]: "bar",
  [ChartType.StabilityDistribution]: "bar",
  [ChartType.TestBaseGrowthDynamics]: "bar",
  [ChartType.StatusAgePyramid]: "bar",
  [ChartType.TrSeverities]: "bar",
  [ChartType.DurationDynamics]: "bar",
  [ChartType.CoverageDiff]: "treemap",
  [ChartType.SuccessRateDistribution]: "treemap",
  [ChartType.ProblemsDistribution]: "heatmap",
  [ChartType.TestingPyramid]: "funnel",
  [ChartType.DurationTrend]: "run-trend",
  [ChartType.RetriesTrend]: "run-trend",
  [ChartType.CategoriesTrend]: "run-trend",
};

export const collectChartAssetFeatures = (charts: readonly { type: string }[]): string[] | undefined => {
  const features = new Set<string>();
  // Select by configuration: history-dependent charts may have no current data.
  for (const chart of charts) {
    if (!Object.prototype.hasOwnProperty.call(chartRenderers, chart.type)) return undefined;
    features.add(`chart-${chartRenderers[chart.type as ChartType]}`);
  }
  return [...features];
};
