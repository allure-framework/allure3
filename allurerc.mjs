import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure 3 Report",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
      },
    },
    dashboards: {
      options: {
        singleFile: false,
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
    log: {
      options: {
        groupBy: "none",
      },
    },
  },
  variables: {},
  environments: {
    chromium: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "chromium"),
    },
    firefox: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "firefox"),
    },
    safari: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "env" && value === "webkit"),
    }
  },
});
