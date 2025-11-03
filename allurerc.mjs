import { defaultChartsConfig, defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_SERVICE_URL, ALLURE_SERVICE_ACCESS_TOKEN, ALLURE_SERVICE_PROJECT } = env;

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
            dataType: "stabilityRateDistribution",
            title: "Stability rate distribution",
          },
          {
            type: "bar",
            dataType: "durationsByLayer",
            title: "Durations by layer histogram",
          },
          {
            type: "bar", // OR it might be trend
            title: "Performance dynamics",
          },
          {
            type: "bar",
            dataType: "fbsuAgePyramid",
            title: "FBSU age pyramid",
          },
          {
            type: "funnel",
            title: "Testing pyramid",
          },
        ],
      },
    },
  },
  variables: {
    env_variable: "unknown",
  },
  environments: {
    foo: {
      variables: {
        env_variable: "foo",
        env_specific_variable: "foo",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
    },
    bar: {
      variables: {
        env_variable: "bar",
        env_specific_variable: "bar",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "bar"),
    },
  },
};

if (ALLURE_SERVICE_URL && ALLURE_SERVICE_ACCESS_TOKEN && ALLURE_SERVICE_PROJECT) {
  config.allureService = {
    url: ALLURE_SERVICE_URL,
    project: ALLURE_SERVICE_PROJECT,
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
    publish: true,
  };
}

export default defineConfig(config);
