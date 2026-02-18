import { type ChartOptions, ChartType } from "./types.js";

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
    type: ChartType.TrSeverities,
    title: "Test results by severities",
    levels: ["blocker", "critical", "normal", "minor", "trivial"],
    statuses: ["passed", "failed", "broken", "skipped", "unknown"],
    includeUnset: true,
  },
  {
    type: ChartType.StatusTransitions,
    title: "Status transitions",
  },
  {
    type: ChartType.TestBaseGrowthDynamics,
    title: "Test base growth dynamics",
  },
  {
    type: ChartType.CoverageDiff,
    title: "Coverage diff map",
  },
  {
    type: ChartType.SuccessRateDistribution,
    title: "Success rate distribution",
  },
  {
    type: ChartType.ProblemsDistribution,
    by: "environment",
    title: "Problems distribution by environment",
  },
  {
    type: ChartType.StabilityDistribution,
    title: "Stability distribution by features",
    skipStatuses: ["skipped", "unknown"],
    threshold: 90,
    groupBy: "feature",
  },
  {
    type: ChartType.StabilityDistribution,
    title: "Stability distribution by epics",
    skipStatuses: ["skipped", "unknown"],
    threshold: 90,
    groupBy: "epic",
  },
  {
    type: ChartType.StabilityDistribution,
    title: "Stability distribution by stories",
    skipStatuses: ["skipped", "unknown"],
    threshold: 90,
    groupBy: "story",
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
    type: ChartType.DurationDynamics,
    title: "Durations dynamics",
  },
  {
    type: ChartType.StatusAgePyramid,
    title: "Status age pyramid",
  },
  {
    type: ChartType.TestingPyramid,
    title: "Testing pyramid",
  },
];
