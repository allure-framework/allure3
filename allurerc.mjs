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
    classic: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure 3 Report (plugin-classic)",
        publish: true,
      },
    },
    allure2: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure 3 Report (plugin-allure2)",
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
    ],
    use: [...qualityGateDefaultRules],
  },
  resolutions: {
    rules: [
      {
        resolution: "accepted",
        testCaseId: ["85d28c01c71394fbdfa81e84cfd7e751", "49dcb3bdd6479da760dd2d91c30a9baa", "0a83faa11f37b5ec6dd119680e00b7c5"],
        comment: "Flaky tests that can't be fixed entirely for CI. On local machine they always pass",
      },
    ],
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
