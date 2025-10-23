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
    title: "Success rate disctribution",
  },
  {
    type: "heatmap",
    title: "Problems distribution by environment",
  },
  {
    type: "bar",
    title: "Stability rate disctribution",
  },
  {
    type: "bar",
    title: "Duration by layer histogram",
  },
  {
    type: "bar",
    title: "Performance dynamics",
  },
  {
    type: "bar",
    title: "FBSU age pyramid",
  },
  {
    type: "funnel",
    title: "Testing pyramid",
  },
];
