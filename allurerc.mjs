import { defineConfig, defaultChartsConfig } from "allure";
import { env } from "node:process";

const { ALLURE_SERVICE_URL, ALLURE_SERVICE_ACCESS_TOKEN } = env;

const config = {
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure 3 Report",
        groupBy: ["module", "parentSuite", "suite", "subSuite"],
        charts: defaultChartsConfig,
      },
    },
    log: {
      options: {
        groupBy: "none",
        filter: ({ status }) => status === "failed" || status === "broken",
      },
    },
    dashboard: {
      options: {
        singleFile: false,
        reportName: "My Dashboard",
        reportLanguage: "en",
        layout: [
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
        ]
      },
    },
  },
  variables: {},
  environments: {
    windows: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "Windows"),
    },
    macos: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "macOS"),
    },
    linux: {
      matcher: ({ labels }) => labels.find(({ name, value }) => name === "os" && value === "Linux"),
    },
  },
};

if (ALLURE_SERVICE_URL && ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    url: ALLURE_SERVICE_URL,
    project: "allure3",
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
    publish: true,
  };
}

export default defineConfig(config);
