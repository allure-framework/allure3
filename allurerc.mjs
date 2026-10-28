import { env } from "node:process";

import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";

const { ALLURE_QUALITY_GATE, ALLURE_REQUIRE_NEW_TESTS, ALLURE_SERVICE_ACCESS_TOKEN } = env;
const qualityGateEnabled = Boolean(ALLURE_QUALITY_GATE);
const requireNewTests = ALLURE_REQUIRE_NEW_TESTS === "1";

const msMetric = (title, group, parent) => ({
  title,
  unit: "ms",
  better: "lower",
  group,
  ...(parent === undefined ? {} : { parent }),
});

const awesomeMetricTitles = {
  "readData": "Read report data",
  "environmentMap": "Build environment map",
  "stats": "Generate statistics",
  "charts": "Generate charts",
  "convert": "Convert test results",
  "categories": "Generate categories",
  "timeline": "Generate timeline",
  "testCases": "Write test cases",
  "tree": "Generate tree",
  "nav": "Generate navigation",
  "searchIndex": "Generate search index",
  "testEnvGroups": "Write test environment groups",
  "environmentsOutput": "Write environment views",
  "attachments": "Write attachments",
  "globals": "Write globals",
  "singleFileReportFiles": "Collect single-file data",
  "staticFiles": "Write static files",
  "summary.create": "Create plugin summary",
};

const awesomeMetrics = Object.fromEntries(
  Object.entries(awesomeMetricTitles).map(([key, title]) => [
    `generate.plugin.awesome.${key}`,
    msMetric(title, "awesome", key === "summary.create" ? "summary.generate" : "generate.plugin.done.awesome"),
  ]),
);

const readResultsMetricTitles = {
  xcresultCheck: "Check xcresult bundle",
  readdir: "Read results directory",
};

const readResultsMetrics = Object.fromEntries(
  Object.entries(readResultsMetricTitles).map(([key, title]) => [
    `generate.readResults.${key}`,
    msMetric(title, "generate", "generate.readResults"),
  ]),
);

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
        groupBy: ["type", "module", "parentSuite", "suite", "subSuite"],
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
        gitFlow: true,
      },
    },
  },
  ...(qualityGateEnabled
    ? {
        qualityGate: {
          rules: [
            {
              maxFailures: 0,
            },
            ...(requireNewTests
              ? [
                  {
                    newTests: true,
                  },
                ]
              : []),
          ],
          use: [...qualityGateDefaultRules],
        },
      }
    : {}),
  resolutions: {
    rules: [
      {
        resolution: "accepted",
        testCaseId: [
          "85d28c01c71394fbdfa81e84cfd7e751",
          "49dcb3bdd6479da760dd2d91c30a9baa",
          "0a83faa11f37b5ec6dd119680e00b7c5",
          "aca386ffeb0e3195d3296f035de6b214",
          "8fb61126e49f99342262db3ac2a85c22",
          "d41ec9abd4ce6884b4b1da1ed54359f1",
        ],
        comment: "Flaky tests that can't be fixed entirely for CI. On local machine they always pass",
      },
    ],
  },
  performance: {
    groups: {
      aql: {
        title: "AQL",
      },
      allure: {
        title: "Allure",
      },
      restoreState: {
        title: "Restore state",
      },
      generate: {
        title: "Generate",
      },
      awesome: {
        title: "Awesome",
      },
      publish: {
        title: "Publish",
      },
      summary: {
        title: "Summary",
      },
    },
    metrics: {
      "aql.parse.simple": msMetric("Parse simple condition", "aql"),
      "aql.parse.complex": msMetric("Parse complex expression", "aql"),
      "aql.parse.array": msMetric("Parse array condition", "aql"),
      "aql.parse.nested": msMetric("Parse nested expression", "aql"),
      "aql.parse.many": msMetric("Parse 1000 expressions", "aql"),
      "aql.filter.small": msMetric("Filter 100 items", "aql"),
      "aql.filter.medium": msMetric("Filter 1000 items", "aql"),
      "aql.filter.large": msMetric("Filter 10000 items", "aql"),
      "aql.filter.complex": msMetric("Filter complex expression", "aql"),
      "aql.filter.in": msMetric("Filter IN operator", "aql"),
      "aql.filter.nested": msMetric("Filter nested properties", "aql"),
      "aql.filter.reuse": msMetric("Filter pre-parsed expression", "aql"),
      "aql.filter.empty": msMetric("Filter empty result", "aql"),
      "aql.workflow.parseAndFilter": msMetric("Parse and filter", "aql"),
      "aql.workflow.multipleFilters": msMetric("Run multiple filters", "aql"),
      "allure.total": msMetric("Allure total", "allure"),
      "restoreState.total": msMetric("Restore state total", "restoreState", "allure.total"),
      "restoreState.dump": msMetric("Restore state dump", "restoreState", "restoreState.total"),
      "restoreState.attachments": msMetric("Restore state attachments", "restoreState", "restoreState.dump"),
      "restoreState.storeRestore": msMetric("Restore state store restore", "restoreState", "restoreState.dump"),
      "generate.total": msMetric("Generate total", "generate", "allure.total"),
      "generate.readResults": msMetric("Read results", "generate", "generate.total"),
      "generate.plugins.done": msMetric("Plugins done", "generate", "generate.total"),
      "generate.plugin.done.awesome": msMetric("Awesome plugin done", "generate", "generate.plugins.done"),
      "generate.plugin.done.classic": msMetric("Classic plugin done", "generate", "generate.plugins.done"),
      "generate.plugin.done.allure2": msMetric("Allure 2 plugin done", "generate", "generate.plugins.done"),
      "generate.plugin.done.log": msMetric("Log plugin done", "generate", "generate.plugins.done"),
      "generate.plugin.done.dashboard": msMetric("Dashboard plugin done", "generate", "generate.plugins.done"),
      "generate.plugin.done.testops": msMetric("Allure TestOps plugin done", "generate", "generate.plugins.done"),
      "summary.generate": msMetric("Generate summary", "summary", "allure.total"),
      "publish.upload.total": msMetric("Upload total", "publish"),
      "publish.upload.plugin.awesome": msMetric("Awesome upload", "publish", "publish.upload.total"),
      "publish.upload.plugin.classic": msMetric("Classic upload", "publish", "publish.upload.total"),
      "publish.upload.plugin.allure2": msMetric("Allure 2 upload", "publish", "publish.upload.total"),
      "publish.upload.plugin.dashboard": msMetric("Dashboard upload", "publish", "publish.upload.total"),
      ...readResultsMetrics,
      ...awesomeMetrics,
    },
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
    uploadConcurrency: 100,
  };
}

export default defineConfig(config);
