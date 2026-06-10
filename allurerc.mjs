import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";
import { env } from "node:process";

const { ALLURE_SERVICE_ACCESS_TOKEN } = env;

/**
 * @type {import("allure").AllureConfig}
 */
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
        timeline: {
          minDuration: 0,
        },
        publish: true,
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
        publish: true,
      },
    },
    testops: {
      options: {
        launchName: `Allure 3 GitHub actions run (${new Date().toISOString()})`,
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
  qualityGate: {
    rules: [
      {
        maxFailures: 0,
        fastFail: true,
      },
    ],
    use: [...qualityGateDefaultRules],
  },
  allureService: {
    accessToken: "ato1.eyJhY2Nlc3NUb2tlbiI6ImUxMjU4MTI5LThhNTQtNDg3ZC04ODAyLTc2MTY3NTc3NjZjZCIsInByb2plY3RJZCI6NzcwLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjgwODAifQ.1c456bb10dcd58ae512539aff23eaa6ad66759e05a09c094e2a6320edc1d1799"
  }
};

// if (ALLURE_SERVICE_ACCESS_TOKEN) {
//   config.allureService = {
//     accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
//   };
// }

export default defineConfig(config);
