import type { Statistic, TestResult } from "@allurereport/core-api";
import { describe, expect, it, vi } from "vitest";
import AwesomePlugin from "../src/index.js";
import { fixtures } from "./fixtures.js";

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
