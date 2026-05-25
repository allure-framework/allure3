import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";
import { endianness } from "node:os";
import { env } from "node:process";
import { createRequire } from "node:module"

const require = createRequire(import.meta.dirname);

const { ALLURE_SERVICE_ACCESS_TOKEN } = env;

/**
 * @type {import("allure").AllureConfig}
 */
const config = {
  name: "Allure Report 3",
  output: "./out/allure-report",
  plugins: {
    awesome1: {
      // import: require.resolve("@allurereport/plugin-awesome"),
      import: "@allurereport/plugin-awesome",
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
    awesome2: {
      // import: require.resolve("@allurereport/plugin-awesome"),
      import: "@allurereport/plugin-awesome",
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
    testops: {
      options: {
        endpoint: "http://localhost:8080",
        launchName: `Allure 3 GitHub actions run (${new Date().toISOString()})`,
        createLaunch: false,
        publish: true,
        accessToken: "2f7cb719-3b48-4998-9983-5fa1fe1bbc10",
        projectId: "770",
      },
    },
    storage: {
      options: {
        accessToken: "ars1.eyJhY2Nlc3NUb2tlbiI6ImtyYzFldGdlR1pzalB0MkwyWGc0T083NDVJYklzc3J6Wm00dWZMUURJSGsiLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAifQ.io9IFyZfhDD21xSMKGQoAqZm49ADZ8bLDz5SVhTFh3g",
      }
    },
    // log: {
    //   options: {
    //     groupBy: "none",
    //     filter: ({ status }) => status === "failed" || status === "broken",
    //   },
    // },
    // dashboard: {
    //   options: {
    //     singleFile: false,
    //     reportName: "My Dashboard",
    //     reportLanguage: "en",
    //     publish: true,
    //   },
    // },
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

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
