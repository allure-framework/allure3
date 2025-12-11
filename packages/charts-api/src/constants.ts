import { BarChartType, type ChartOptions, ChartType, FunnelChartType, TreeMapChartType } from "./types.js";

export const DEFAULT_CHART_HISTORY_LIMIT = 10;

export const defaultChartsConfig: ChartOptions[] = [
  {
    type: ChartType.CurrentStatus,
    title: "Current status",
  },
  {
    type: ChartType.StatusDynamics,
    title: "Status dynamics",
  },
  {
    type: ChartType.Bar,
    dataType: BarChartType.StatusBySeverity,
    title: "Test result severities",
  },
  {
    type: ChartType.StatusTransitions,
    title: "Status transitions",
  },
  {
    type: ChartType.Bar,
    dataType: BarChartType.StatusChangeTrend,
    title: "Test base growth dynamics",
  },
  {
    type: ChartType.TreeMap,
    dataType: TreeMapChartType.CoverageDiff,
    title: "Coverage diff map",
  },
  {
    type: ChartType.TreeMap,
    dataType: TreeMapChartType.SuccessRateDistribution,
    title: "Success rate distribution",
  },
  {
    type: ChartType.HeatMap,
    title: "Problems distribution by environment",
  },
  {
    type: ChartType.Bar,
    dataType: BarChartType.StabilityRateDistribution,
    title: "Stability rate distribution",
  },
  {
    type: ChartType.Durations,
    title: "Durations histogram",
    groupBy: "none",
  },
  {
    type: ChartType.Durations,
    title: "Durations by layer histogram",
    groupBy: "layer",
  },
  {
    type: ChartType.Bar,
    dataType: "performanceTrend" as any,
    title: "Performance dynamics",
  },
  {
    type: ChartType.Bar,
    dataType: BarChartType.FbsuAgePyramid,
    title: "FBSU age pyramid",
  },
  {
    type: ChartType.Funnel,
    dataType: FunnelChartType.TestingPyramid,
    title: "Testing pyramid",
  },
];
