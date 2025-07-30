import { defineConfig } from "allure";
import { createRequire } from "node:module"

const require = createRequire(import.meta.url);

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
  plugins: {
    "allure2": {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    "classic": {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
      },
    },
    "awesome": {
      options: {
        reportName: "HelloWorld",
        singleFile: false,
        reportLanguage: "en",
        open: false,
        charts: chartLayout,
      },
    },
    "dashboard": {
      options: {
        singleFile: false,
        reportName: "HelloWorld-Dashboard",
        reportLanguage: "en",
        layout: chartLayout,
      },
    },
    "csv": {
      options: {
        fileName: "allure-report.csv",
      },
    },
    "log": {
      options: {
        groupBy: "none",
      },
    },
    "quality-gate": {
      import: require.resolve("@allurereport/plugin-quality-gate"),
      options: {
        fastFail: true,
        rules: [
          {
            minTestsCount: 10,
          },
          {
            id: "first-gate",
            maxFailures: 1,
          },
          {
            id: "second-gate",
            successRate: 0.9,
          },
        ],
      },
    },
  },
  // allureService: {
  //   url: "http://localhost:5173",
  //   project: "sandbox",
  // },
});
