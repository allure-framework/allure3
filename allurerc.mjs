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
  quarantinePath: "./quarantine.json",
  knownIssuesPath: "./known-issues.json",
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
  qualityGate: {
    rules: [
      {
        maxFailures: 0,
      },
      {
        maxQuarantine: 0,
      }
    ],
    use: [...qualityGateDefaultRules],
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
