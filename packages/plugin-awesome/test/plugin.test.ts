import { getTestResultsStats } from "@allurereport/core";
import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import AwesomePlugin from "../src/index.js";

const fixtures = {
  testResults: {
    passed: {
      name: "passed sample",
      status: "passed",
    } as TestResult,
    failed: {
      name: "failed sample",
      status: "failed",
    } as TestResult,
    broken: {
      name: "broken sample",
      status: "broken",
    } as TestResult,
    unknown: {
      name: "unknown sample",
      status: "unknown",
    } as TestResult,
    skipped: {
      name: "skipped sample",
      status: "skipped",
    } as TestResult,
  },
  context: {} as PluginContext,
  store: {
    allTestResults: () =>
      Promise.resolve([
        fixtures.testResults.passed,
        fixtures.testResults.failed,
        fixtures.testResults.broken,
        fixtures.testResults.skipped,
        fixtures.testResults.unknown,
      ]),
    testsStatistic: async (filter) => {
      const all = await fixtures.store.allTestResults();

      return getTestResultsStats(all, filter);
    },
  } as AllureStore,
};

describe("plugin", () => {
  describe("info", () => {
    it("should returns info for all test results in the store", async () => {
      const plugin = new AwesomePlugin();
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info).toEqual({
        stats: {
          passed: 1,
          failed: 1,
          broken: 1,
          skipped: 1,
          unknown: 1,
          total: 5,
        },
      });
    });

    it("should returns info for filtered test results in the store", async () => {
      const plugin = new AwesomePlugin({
        filter: ({ status }) => status === "passed",
      });
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info).toEqual({
        stats: {
          passed: 1,
          total: 1,
        },
      });
    });
  });
});
