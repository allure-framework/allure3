import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";
import { env } from "node:process";

const { ALLURE_SERVICE_ACCESS_TOKEN } = env;

const msMetric = (title, group) => ({
  title,
  unit: "ms",
  better: "lower",
  group,
});

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
  performance: {
    groups: {
      allure: {
        title: "Allure",
      },
      restoreState: {
        title: "Restore state",
      },
      generate: {
        title: "Generate",
      },
      publish: {
        title: "Publish",
      },
      summary: {
        title: "Summary",
      },
    },
    metrics: {
      "allure.total": msMetric("Allure total", "allure"),
      "restoreState.total": msMetric("Restore state total", "restoreState"),
      "restoreState.dump": msMetric("Restore state dump", "restoreState"),
      "restoreState.attachments": msMetric("Restore state attachments", "restoreState"),
      "restoreState.storeRestore": msMetric("Restore state store restore", "restoreState"),
      "generate.total": msMetric("Generate total", "generate"),
      "generate.readResults": msMetric("Read results", "generate"),
      "generate.plugins.done": msMetric("Plugins done", "generate"),
      "generate.plugin.done.awesome": msMetric("Awesome plugin done", "generate"),
      "generate.plugin.done.classic": msMetric("Classic plugin done", "generate"),
      "generate.plugin.done.allure2": msMetric("Allure 2 plugin done", "generate"),
      "generate.plugin.done.log": msMetric("Log plugin done", "generate"),
      "generate.plugin.done.dashboard": msMetric("Dashboard plugin done", "generate"),
      "generate.plugin.done.testops": msMetric("TestOps plugin done", "generate"),
      "summary.generate": msMetric("Generate summary", "summary"),
      "publish.upload.total": msMetric("Upload total", "publish"),
      "publish.upload.plugin.awesome": msMetric("Awesome upload", "publish"),
      "publish.upload.plugin.classic": msMetric("Classic upload", "publish"),
      "publish.upload.plugin.allure2": msMetric("Allure 2 upload", "publish"),
      "publish.upload.plugin.dashboard": msMetric("Dashboard upload", "publish"),
    },
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
