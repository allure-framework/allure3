import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";
import { env } from "node:process";

const { ALLURE_SERVICE_URL, ALLURE_SERVICE_ACCESS_TOKEN, ALLURE_SERVICE_PROJECT } = env;

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
