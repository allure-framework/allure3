import type { Statistic, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import AwesomePlugin from "../src/index.js";

// duplicated the code from core to avoid circular dependency
export const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
      if (filter && !filter(test)) {
        return acc;
      }

      if (!acc[test.status]) {
        acc[test.status] = 0;
      }

      acc[test.status]!++;

      return acc;
    },
    { total: trsToProcess.length } as Statistic,
  );
};
const fixtures: any = {
  testResults: {
    passed: {
      name: "passed sample",
      status: "passed",
    },
    failed: {
      name: "failed sample",
      status: "failed",
    },
    broken: {
      name: "broken sample",
      status: "broken",
    },
    unknown: {
      name: "unknown sample",
      status: "unknown",
    },
    skipped: {
      name: "skipped sample",
      status: "skipped",
    },
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
      const plugin = new AwesomePlugin({ reportName: "Sample report" });
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info).toEqual({
        duration: 0,
        name: "Sample report",
        status: "failed",
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

    it("should return info for filtered test results in the store", async () => {
      const plugin = new AwesomePlugin({
        reportName: "Sample report",
        filter: ({ status }) => status === "passed",
      });
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info).toEqual({
        duration: 0,
        name: "Sample report",
        status: "passed",
        stats: {
          passed: 1,
          total: 1,
        },
      });
    });
  });
});
