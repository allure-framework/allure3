import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  historyPath: "./history.jsonl",
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
      },
    },
    dashboards: {
      options: {
        singleFile: false,
        reportName: "HelloWorld-Dashboards",
        reportLanguage: "en",
        layout: [
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
              executionIdFn: (executionOrder) => `build-${executionOrder}`,
              executionNameFn: (executionOrder) => `build #${executionOrder}`,
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
        ],
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
});
