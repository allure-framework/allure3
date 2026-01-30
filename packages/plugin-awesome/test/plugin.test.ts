import type { Statistic, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, ReportFiles } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";
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
  context: {
    reportUuid: "report-uuid",
  } as PluginContext,
  store: {
    allTestResults: () =>
      Promise.resolve([
        fixtures.testResults.passed,
        fixtures.testResults.failed,
        fixtures.testResults.broken,
        fixtures.testResults.skipped,
        fixtures.testResults.unknown,
      ]),
    allNewTestResults: () => Promise.resolve([]),
    testsStatistic: async (filter: (tr: TestResult) => boolean) => {
      const all = await fixtures.store.allTestResults();

      return getTestResultsStats(all, filter);
    },
  } as unknown as AllureStore,
};

describe("plugin", () => {
  describe("info", () => {
    it("should returns info for all test results in the store", async () => {
      const plugin = new AwesomePlugin({ reportName: "Sample report" });
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info).toEqual({
        createdAt: 0,
        duration: 0,
        name: "Sample report",
        plugin: "Awesome",
        status: "failed",
        stats: {
          passed: 1,
          failed: 1,
          broken: 1,
          skipped: 1,
          unknown: 1,
          total: 5,
        },
        newTests: [],
        flakyTests: [],
        retryTests: [],
        meta: {
          reportId: fixtures.context.reportUuid,
          singleFile: false,
          withTestResultsLinks: true,
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
        createdAt: 0,
        duration: 0,
        name: "Sample report",
        status: "passed",
        plugin: "Awesome",
        stats: {
          passed: 1,
          total: 1,
        },
        newTests: [],
        flakyTests: [],
        retryTests: [],
        meta: {
          reportId: fixtures.context.reportUuid,
          singleFile: false,
          withTestResultsLinks: true,
        },
      });
    });

    it("should add single file mode flag to the summary meta", async () => {
      const plugin = new AwesomePlugin({
        reportName: "Sample report",
        singleFile: true,
      });
      const info = await plugin.info(fixtures.context, fixtures.store);

      expect(info?.meta?.singleFile).toBe(true);
    });
  });

  describe("tree filters", () => {
    it("should write only tags from filtered tests to tree-filters.json when filter is passed in config", async () => {
      const testResultsWithTags: TestResult[] = [
        {
          id: "tr-1",
          name: "passed test",
          status: "passed",
          labels: [{ name: "tag", value: "smoke" }],
        },
        {
          id: "tr-2",
          name: "failed test",
          status: "failed",
          labels: [{ name: "tag", value: "regression" }],
        },
        {
          id: "tr-3",
          name: "another passed test",
          status: "passed",
          labels: [{ name: "tag", value: "critical" }],
        },
      ] as TestResult[];

      const addedFiles = new Map<string, Buffer>();
      const reportFiles: ReportFiles = {
        addFile: vi.fn(async (path: string, data: Buffer) => {
          addedFiles.set(path, data);
          return path;
        }),
      };

      const store: AllureStore = {
        metadataByKey: vi.fn().mockResolvedValue(undefined),
        allEnvironments: vi.fn().mockResolvedValue([]),
        allAttachments: vi.fn().mockResolvedValue([]),
        allTestResults: vi.fn().mockResolvedValue(testResultsWithTags),
        testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) =>
          getTestResultsStats(testResultsWithTags, filter),
        ),
        allTestEnvGroups: vi.fn().mockResolvedValue([]),
        allGlobalAttachments: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue(undefined),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        qualityGateResults: vi.fn().mockResolvedValue([]),
        fixturesByTrId: vi.fn().mockResolvedValue([]),
        historyByTrId: vi.fn().mockResolvedValue([]),
        retriesByTrId: vi.fn().mockResolvedValue([]),
        attachmentsByTrId: vi.fn().mockResolvedValue([]),
        allVariables: vi.fn().mockResolvedValue([]),
        envVariables: vi.fn().mockResolvedValue([]),
        allHistoryDataPoints: vi.fn().mockResolvedValue([]),
        allNewTestResults: vi.fn().mockResolvedValue([]),
        attachmentContentById: vi.fn().mockResolvedValue(undefined),
      } as unknown as AllureStore;

      const context: PluginContext = {
        id: "Awesome",
        publish: true,
        state: {} as PluginContext["state"],
        allureVersion: "3.0.0",
        reportUuid: "report-uuid",
        reportName: "Test report",
        reportFiles,
        output: "/tmp/out",
      };

      const plugin = new AwesomePlugin({
        filter: (tr) => tr.status === "passed",
      });

      await plugin.start(context);
      await plugin.update(context, store);

      const treeFiltersPath = "widgets/tree-filters.json";
      expect(addedFiles.has(treeFiltersPath)).toBe(true);

      const treeFiltersBuffer = addedFiles.get(treeFiltersPath);
      const treeFilters = JSON.parse(treeFiltersBuffer!.toString("utf-8")) as { tags: string[] };

      // Only tags from filtered (passed) tests: "smoke" and "critical", sorted
      expect(treeFilters.tags).toEqual(["critical", "smoke"]);
      // Tag from excluded (failed) test must not be present
      expect(treeFilters.tags).not.toContain("regression");
    });
  });
});
