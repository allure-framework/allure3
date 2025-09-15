import { defineConfig } from "allure";

const chartLayout = [
  {
    type: "trend",
    dataType: "status",
    mode: "percent",
  },
  {
    type: "trend",
    dataType: "status",
    limit: 10,
  },
  {
    title: "Custom Status Trend",
    type: "trend",
    dataType: "status",
    mode: "percent",
    limit: 15,
  },
  {
    type: "trend",
    dataType: "status",
    limit: 15,
    metadata: {
      executionIdAccessor: (executionOrder) => `build-${executionOrder}`,
      executionNameAccessor: (executionOrder) => `build #${executionOrder}`,
    },
  },
  {
    type: "trend",
    dataType: "severity",
    limit: 15,
  },
  {
    type: "pie",
  },
  {
    type: "pie",
    title: "Custom Pie",
  },
];

export const dashboardLayout = [
  {
    type: "pie",
    title: "Current status"
  },
  {
    type: "trend",
    dataType: "status",
    title: "Status dynamics"
  },
  {
    type: "bar",
    dataType: "statusBySeverity",
    title: "Test result severities"
  },
  {
    type: "bar",
    dataType: "statusTrend",
    title: "Status change dynamics"
  },
  {
    type: "bar",
    dataType: "statusChangeTrend",
    title: "Test base growth dynamics"
  },
  {
    type: "treemap",
    dataType: "coverageDiff",
    title: "Coverage diff map"
  },
  {
    type: "treemap",
    dataType: "successRateDistribution",
    title: "Success rate disctribution"
  },
  {
    type: "heatmap",
    title: "Problems distribution by environment"
  },
  {
    type: "bar",
    title: "Stability rate disctribution"
  },
  {
    type: "bar",
    title: "Duration by layer histogram"
  },
  {
    type: "bar", // OR it might be trend
    title: "Performance dynamics"
  },
  {
    type: "bar",
    title: "FBSU age pyramid"
  },
  {
    type: "funnel",
    title: "Testing pyramid"
  },
];

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
  qualityGate: {
    rules: [
      {
        maxFailures: 5,
        fastFail: true,
      },
    ],
  },
  plugins: {
    allure2: {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    classic: {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    awesome: {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
        open: false,
        charts: chartLayout,
      },
    },
    dashboard: {
      options: {
        singleFile: false,
        reportName: "HelloWorld-Dashboard",
        reportLanguage: "en",
        layout: dashboardLayout,
      },
    },
    csv: {
      options: {
        fileName: "allure-report.csv",
      },
    },
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
  // allureService: {
  //   url: "http://localhost:5173",
  //   project: "sandbox",
  // },
});
