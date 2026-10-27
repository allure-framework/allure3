import { env } from "node:process";

import { defineConfig } from "allure";
import { qualityGateDefaultRules } from "allure/rules";

const { ALLURE_QUALITY_GATE, ALLURE_REQUIRE_NEW_TESTS, ALLURE_SERVICE_ACCESS_TOKEN } = env;
const qualityGateEnabled = Boolean(ALLURE_QUALITY_GATE);
const requireNewTests = ALLURE_REQUIRE_NEW_TESTS === "1";

const msMetric = ({ title, group, parent }) => ({
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
    msMetric({ title, group: "awesome", parent: key === "summary.create" ? "summary.generate" : "generate.plugin.done.awesome" }),
  ]),
);

const readResultsMetricTitles = {
  xcresultCheck: "Check xcresult bundle",
  readdir: "Read results directory",
};

const readResultsMetrics = Object.fromEntries(
  Object.entries(readResultsMetricTitles).map(([key, title]) => [
    `generate.readResults.${key}`,
    msMetric({ title, group: "generate", parent: "generate.readResults" }),
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
      "aql.parse.simple": msMetric({ title: "Parse simple condition", group: "aql" }),
      "aql.parse.complex": msMetric({ title: "Parse complex expression", group: "aql" }),
      "aql.parse.array": msMetric({ title: "Parse array condition", group: "aql" }),
      "aql.parse.nested": msMetric({ title: "Parse nested expression", group: "aql" }),
      "aql.parse.many": msMetric({ title: "Parse 1000 expressions", group: "aql" }),
      "aql.filter.small": msMetric({ title: "Filter 100 items", group: "aql" }),
      "aql.filter.medium": msMetric({ title: "Filter 1000 items", group: "aql" }),
      "aql.filter.large": msMetric({ title: "Filter 10000 items", group: "aql" }),
      "aql.filter.complex": msMetric({ title: "Filter complex expression", group: "aql" }),
      "aql.filter.in": msMetric({ title: "Filter IN operator", group: "aql" }),
      "aql.filter.nested": msMetric({ title: "Filter nested properties", group: "aql" }),
      "aql.filter.reuse": msMetric({ title: "Filter pre-parsed expression", group: "aql" }),
      "aql.filter.empty": msMetric({ title: "Filter empty result", group: "aql" }),
      "aql.workflow.parseAndFilter": msMetric({ title: "Parse and filter", group: "aql" }),
      "aql.workflow.multipleFilters": msMetric({ title: "Run multiple filters", group: "aql" }),
      "allure.total": msMetric({ title: "Allure total", group: "allure" }),
      "restoreState.total": msMetric({ title: "Restore state total", group: "restoreState", parent: "allure.total" }),
      "restoreState.dump": msMetric({ title: "Restore state dump", group: "restoreState", parent: "restoreState.total" }),
      "restoreState.attachments": msMetric({ title: "Restore state attachments", group: "restoreState", parent: "restoreState.dump" }),
      "restoreState.storeRestore": msMetric({ title: "Restore state store restore", group: "restoreState", parent: "restoreState.dump" }),
      "generate.total": msMetric({ title: "Generate total", group: "generate", parent: "allure.total" }),
      "generate.readResults": msMetric({ title: "Read results", group: "generate", parent: "generate.total" }),
      "generate.plugins.done": msMetric({ title: "Plugins done", group: "generate", parent: "generate.total" }),
      "generate.plugin.done.awesome": msMetric({ title: "Awesome plugin done", group: "generate", parent: "generate.plugins.done" }),
      "generate.plugin.done.classic": msMetric({ title: "Classic plugin done", group: "generate", parent: "generate.plugins.done" }),
      "generate.plugin.done.allure2": msMetric({ title: "Allure 2 plugin done", group: "generate", parent: "generate.plugins.done" }),
      "generate.plugin.done.log": msMetric({ title: "Log plugin done", group: "generate", parent: "generate.plugins.done" }),
      "generate.plugin.done.dashboard": msMetric({ title: "Dashboard plugin done", group: "generate", parent: "generate.plugins.done" }),
      "generate.plugin.done.testops": msMetric({ title: "Allure TestOps plugin done", group: "generate", parent: "generate.plugins.done" }),
      "summary.generate": msMetric({ title: "Generate summary", group: "summary", parent: "allure.total" }),
      "publish.upload.total": msMetric({ title: "Upload total", group: "publish" }),
      "publish.upload.plugin.awesome": msMetric({ title: "Awesome upload", group: "publish", parent: "publish.upload.total" }),
      "publish.upload.plugin.classic": msMetric({ title: "Classic upload", group: "publish", parent: "publish.upload.total" }),
      "publish.upload.plugin.allure2": msMetric({ title: "Allure 2 upload", group: "publish", parent: "publish.upload.total" }),
      "publish.upload.plugin.dashboard": msMetric({ title: "Dashboard upload", group: "publish", parent: "publish.upload.total" }),
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
