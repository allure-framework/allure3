import { defaultChartsConfig, defineConfig } from "allure";

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

const comboRules = [
  {
    name: "Failed / Severity+Layer / Msg+History+Env",
    matchers: { statuses: ["failed"] },
    groupBy: ["severity", { label: "layer" }],
    groupByMessage: true,
    groupByHistoryId: true,
    groupByEnvironment: true,
  },
  {
    name: "Failed / Owner / Msg",
    matchers: { statuses: ["failed"] },
    groupBy: ["owner"],
    groupByMessage: true,
    groupByEnvironment: false,
  },
  {
    name: "Broken / Owner / Env",
    matchers: { statuses: ["broken"] },
    groupBy: ["owner"],
    groupByMessage: false,
    groupByEnvironment: true,
  },
  {
    name: "Broken / Message only (no env)",
    matchers: { statuses: ["broken"] },
    groupByMessage: true,
    groupByHistoryId: false,
    groupByEnvironment: false,
  },
  {
    name: "Broken / Feature+Story / Env",
    matchers: { statuses: ["broken"] },
    groupBy: [{ label: "feature" }, { label: "story" }],
    groupByMessage: false,
    groupByEnvironment: true,
  },
  {
    name: "Failed+Broken / Layer / Env",
    matchers: { statuses: ["failed", "broken"] },
    groupBy: [{ label: "layer" }],
    groupByMessage: false,
    groupByEnvironment: true,
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
        publish: true,
        categories: {
          rules: comboRules,
        },
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
});
