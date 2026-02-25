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
    name: "Layer / Severity+Layer / Msg / EnvGroup",
    matchers: { labels: { layer: /.+/ } },
    groupBy: ["severity", { label: "layer" }],
    groupByMessage: true,
    groupEnvironments: true,
  },
  {
    name: "Owner / Owner / Msg",
    matchers: { labels: { owner: /.+/ } },
    groupBy: ["owner"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    name: "Feature / Status / EnvGroup",
    matchers: { labels: { feature: /.+/ } },
    groupBy: ["status"],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    name: "Story / Transition+Env",
    matchers: { labels: { story: /.+/ } },
    groupBy: ["transition", "environment"],
    groupByMessage: false,
    groupEnvironments: false,
  },
  {
    name: "Transitions / Transition+EnvGroup",
    matchers: { transitions: ["new", "fixed", "regressed", "malfunctioned"] },
    groupBy: ["transition", "environment"],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    name: "Flaky / Flaky / Msg",
    matchers: { flaky: true },
    groupBy: ["flaky"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    name: "Non-flaky / Flaky / Msg",
    matchers: { flaky: false },
    groupBy: ["flaky"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    name: "Feature+Story / EnvGroup",
    matchers: { labels: { feature: /.+/, story: /.+/ } },
    groupBy: [{ label: "feature" }, { label: "story" }],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    name: "Env label / Environment / Msg",
    matchers: { labels: { env: /.+/ } },
    groupBy: ["environment"],
    groupByMessage: true,
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
      {
        // Fails: not all tests have env "foo" (some have "bar" or "default")
        allTestsContainEnv: "foo",
      },
      {
        // Fails: "staging" is not present in the run (only foo, bar, default exist)
        environmentsTested: ["foo", "bar", "staging"],
      },
    ],
  },
  categories: {
    rules: comboRules,
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
