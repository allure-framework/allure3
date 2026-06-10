import { defaultChartsConfig, defineConfig } from "allure";

const MAX_ENV_NAME_64 = "env-" + "x".repeat(60);
const MAX_ENV_NAME_64_UNICODE = "я".repeat(64);
const sandboxTestopsEnabled = process.env.SANDBOX_ENABLE_TESTOPS === "true";
const sandboxTestopsToken = process.env.TESTOPS_SANDBOX_TOKEN;

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
    id: "sandbox.layer-severity-message-envgroup",
    name: "Layer / Severity+Layer / Msg / EnvGroup",
    matchers: { labels: { layer: /.+/ } },
    groupBy: ["severity", { label: "layer" }],
    groupByMessage: true,
    groupEnvironments: true,
  },
  {
    id: "sandbox.owner-message",
    name: "Owner / Owner / Msg",
    matchers: { labels: { owner: /.+/ } },
    groupBy: ["owner"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    id: "sandbox.feature-status-envgroup",
    name: "Feature / Status / EnvGroup",
    matchers: { labels: { feature: /.+/ } },
    groupBy: ["status"],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    id: "sandbox.story-transition-environment",
    name: "Story / Transition+Env",
    matchers: { labels: { story: /.+/ } },
    groupBy: ["transition", "environment"],
    groupByMessage: false,
    groupEnvironments: false,
  },
  {
    id: "sandbox.transitions-transition-environment-envgroup",
    name: "Transitions / Transition+EnvGroup",
    matchers: { transitions: ["new", "fixed", "regressed", "malfunctioned"] },
    groupBy: ["transition", "environment"],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    id: "sandbox.flaky-message",
    name: "Flaky / Flaky / Msg",
    matchers: { flaky: true },
    groupBy: ["flaky"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    id: "sandbox.non-flaky-message",
    name: "Non-flaky / Flaky / Msg",
    matchers: { flaky: false },
    groupBy: ["flaky"],
    groupByMessage: true,
    groupEnvironments: false,
  },
  {
    id: "sandbox.feature-story-envgroup",
    name: "Feature+Story / EnvGroup",
    matchers: { labels: { feature: /.+/, story: /.+/ } },
    groupBy: [{ label: "feature" }, { label: "story" }],
    groupByMessage: false,
    groupEnvironments: true,
  },
  {
    id: "sandbox.env-label-environment-message",
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
  hideLabels: ["owner"],
  // qualityGate: {
  //   rules: [
  //     {
  //       maxFailures: 5,
  //       fastFail: true,
  //     },
  //     {
  //       // Fails: not all tests have env "foo" (some have "bar" or "default")
  //       allTestsContainEnv: "foo",
  //     },
  //     {
  //       // Fails: "staging" is not present in the run (only foo, bar, default exist)
  //       environmentsTested: ["foo", "bar", "staging"],
  //     },
  //   ],
  // },
  categories: {
    rules: comboRules,
  },
  plugins: {
    // allure2: {
    //   options: {
    //     reportName: "HelloWorld",
    //     singleFile: false,
    //     reportLanguage: "en",
    //   },
    // },
    // classic: {
    //   options: {
    //     reportName: "HelloWorld",
    //     singleFile: false,
    //     reportLanguage: "en",
    //   },
    // },
    // awesome: {
    //   options: {
    //     reportName: "HelloWorld",
    //     singleFile: false,
    //     theme: "light",
    //     reportLanguage: "en",
    //     open: false,
    //     charts: chartLayout,
    //     publish: true,
    //   },
    // },
    // dashboard: {
    //   options: {
    //     singleFile: false,
    //     reportName: "HelloWorld-Dashboard",
    //     reportLanguage: "en",
    //     layout: defaultChartsConfig,
    //   },
    // },
    // csv: {
    //   options: {
    //     fileName: "allure-report.csv",
    //   },
    // },
    // log: {
    //   options: {
    //     groupBy: "none",
    //   },
    // },
    testops: {
      enabled: true,
      options: {
        accessToken: "98afa9bc-96df-466e-bc96-9293911319fb",
        projectId: "1",
        endpoint: "http://localhost:8080",
        launchName: "Hello",
      }
    },
    // ...(sandboxTestopsEnabled
    //   ? {
    //       testops: {
    //         options: {
    //           accessToken: sandboxTestopsToken,
    //           projectId: "1",
    //           endpoint: "http://localhost:8080",
    //         },
    //       },
    //     }
    // : {}),
  },
  variables: {
    env_variable: "unknown",
  },
  // allureService: {
  //   accessToken: "ato1.eyJhY2Nlc3NUb2tlbiI6ImUxMjU4MTI5LThhNTQtNDg3ZC04ODAyLTc2MTY3NTc3NjZjZCIsInByb2plY3RJZCI6NzcwLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjgwODAifQ.1c456bb10dcd58ae512539aff23eaa6ad66759e05a09c094e2a6320edc1d1799"
  // },
  // allureService: {
  //   url: "http://localhost:3000",
  //   accessToken: "storage_test"
  // },
  environments: {
    foo: {
      name: "foo",
      variables: {
        env_variable: "foo",
        env_specific_variable: "foo",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
    },
    bar: {
      name: "bar",
      variables: {
        env_variable: "bar",
        env_specific_variable: "bar",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "bar"),
    },
    max_env_name_64: {
      name: MAX_ENV_NAME_64,
      variables: {
        env_variable: MAX_ENV_NAME_64,
        env_specific_variable: "max-length-64",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === MAX_ENV_NAME_64),
    },
    max_env_name_64_unicode: {
      name: MAX_ENV_NAME_64_UNICODE,
      variables: {
        env_variable: MAX_ENV_NAME_64_UNICODE,
        env_specific_variable: "max-length-64-unicode",
      },
      matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === MAX_ENV_NAME_64_UNICODE),
    },
  },
});
