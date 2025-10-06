import { defineConfig, defaultChartsConfig } from "allure";

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
        layout: defaultChartsConfig,
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
  // TODO: remove after tests
  allureTestOps: {
    url: "https://testing.testops.cloud",
    token: "fcd03182-96f5-4693-862e-552460ea2427",
    project: "13075",
  }
});
