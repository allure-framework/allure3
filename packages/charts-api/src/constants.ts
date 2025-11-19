export const DEFAULT_CHART_HISTORY_LIMIT = 10;

export const defaultChartsConfig = [
  {
    type: "pie",
    title: "Current status",
  },
  {
    type: "trend",
    dataType: "status",
    title: "Status dynamics",
  },
  {
    type: "bar",
    dataType: "statusBySeverity",
    title: "Test result severities",
  },
  {
    type: "bar",
    dataType: "statusTrend",
    title: "Status change dynamics",
  },
  {
    type: "bar",
    dataType: "statusChangeTrend",
    title: "Test base growth dynamics",
  },
  {
    type: "treemap",
    dataType: "coverageDiff",
    title: "Coverage diff map",
  },
  {
    type: "treemap",
    dataType: "successRateDistribution",
    title: "Success rate distribution",
  },
  {
    type: "heatmap",
    title: "Problems distribution by environment",
  },
  {
    type: "bar",
    dataType: "stabilityRateDistribution",
    title: "Stability rate distribution",
  },
  {
    type: "bar",
    dataType: "durationsByLayer",
    title: "Durations by layer histogram",
  },
  {
    type: "bar",
    dataType: "performanceTrend",
    title: "Performance dynamics",
  },
  {
    type: "bar",
    dataType: "fbsuAgePyramid",
    title: "FBSU age pyramid",
  },
  {
    type: "funnel",
    dataType: "testingPyramid",
    title: "Testing pyramid",
  },
];
