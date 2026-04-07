import type { EnvironmentIdentity, Statistic, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, ReportFiles } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";

import AwesomePlugin from "../src/index.js";

// duplicated the code from core to avoid circular dependency
export const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
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
    allTestResults: async (options?: { includeHidden?: boolean; filter?: (tr: TestResult) => boolean }) => {
      const all = [
        fixtures.testResults.passed,
        fixtures.testResults.failed,
        fixtures.testResults.broken,
        fixtures.testResults.skipped,
        fixtures.testResults.unknown,
      ];
      const trs = options?.filter ? all.filter(options.filter) : all;

      return trs;
    },
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
        allEnvironmentIdentities: vi.fn().mockResolvedValue([]),
        allAttachments: vi.fn().mockResolvedValue([]),
        allTestResults: vi.fn(async (options?: { includeHidden?: boolean; filter?: (tr: TestResult) => boolean }) => {
          const trs = options?.filter ? testResultsWithTags.filter(options.filter) : testResultsWithTags;
          return trs;
        }),
        testResultsByEnvironment: vi.fn().mockResolvedValue([]),
        testResultsByEnvironmentId: vi.fn().mockResolvedValue([]),
        environmentIdByTrId: vi.fn().mockImplementation(async () => "default"),
        testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) =>
          getTestResultsStats(testResultsWithTags, filter),
        ),
        allTestEnvGroups: vi.fn().mockResolvedValue([]),
        allGlobalAttachments: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue(undefined),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        qualityGateResults: vi.fn().mockResolvedValue([]),
        qualityGateResultsByEnv: vi.fn().mockResolvedValue({}),
        qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
        fixturesByTrId: vi.fn().mockResolvedValue([]),
        historyByTrId: vi.fn().mockResolvedValue([]),
        retriesByTrId: vi.fn().mockResolvedValue([]),
        attachmentsByTrId: vi.fn().mockResolvedValue([]),
        allVariables: vi.fn().mockResolvedValue([]),
        envVariables: vi.fn().mockResolvedValue([]),
        envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
        allHistoryDataPoints: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironment: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironmentId: vi.fn().mockResolvedValue([]),
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

  describe("environment-specific outputs", () => {
    it("should keep env-specific widgets separated by environment id when allEnvironments exposes one shared display name", async () => {
      const qaATestResult = {
        id: "tr-qa-a",
        name: "qa a test",
        status: "passed",
        environment: "QA",
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        hidden: false,
        sourceMetadata: { readerId: "system", metadata: {} },
      } as TestResult;
      const qaBTestResult = {
        id: "tr-qa-b",
        name: "qa b test",
        status: "failed",
        environment: "QA",
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        hidden: false,
        sourceMetadata: { readerId: "system", metadata: {} },
      } as TestResult;
      const testResults = [qaATestResult, qaBTestResult];
      const addedFiles = new Map<string, Buffer>();
      const reportFiles: ReportFiles = {
        addFile: vi.fn(async (path: string, data: Buffer) => {
          addedFiles.set(path, data);
          return path;
        }),
      };

      const store: AllureStore = {
        metadataByKey: vi.fn().mockResolvedValue(undefined),
        allEnvironments: vi.fn().mockResolvedValue(["QA"]),
        allEnvironmentIdentities: vi.fn().mockResolvedValue([
          { id: "qa_a", name: "QA" },
          { id: "qa_b", name: "QA" },
        ] satisfies EnvironmentIdentity[]),
        allAttachments: vi.fn().mockResolvedValue([]),
        allTestResults: vi.fn(async (options?: { includeHidden?: boolean; filter?: (tr: TestResult) => boolean }) => {
          const trs = options?.filter ? testResults.filter(options.filter) : testResults;
          return trs;
        }),
        testResultsByEnvironment: vi.fn().mockResolvedValue([qaATestResult, qaBTestResult]),
        testResultsByEnvironmentId: vi
          .fn()
          .mockImplementation(async (environmentId: string) =>
            environmentId === "qa_a" ? [qaATestResult] : environmentId === "qa_b" ? [qaBTestResult] : [],
          ),
        environmentIdByTrId: vi.fn().mockImplementation(async (trId: string) => (trId === "tr-qa-a" ? "qa_a" : "qa_b")),
        testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => getTestResultsStats(testResults, filter)),
        allTestEnvGroups: vi.fn().mockResolvedValue([]),
        allGlobalAttachments: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue(undefined),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        qualityGateResults: vi.fn().mockResolvedValue([]),
        qualityGateResultsByEnv: vi.fn().mockResolvedValue({}),
        qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
        fixturesByTrId: vi.fn().mockResolvedValue([]),
        historyByTrId: vi.fn().mockResolvedValue([]),
        retriesByTrId: vi.fn().mockResolvedValue([]),
        attachmentsByTrId: vi.fn().mockResolvedValue([]),
        allVariables: vi.fn().mockResolvedValue([]),
        envVariables: vi.fn().mockResolvedValue([]),
        envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
        allHistoryDataPoints: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironment: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironmentId: vi.fn().mockResolvedValue([]),
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
        charts: [],
      });

      await plugin.start(context);
      await plugin.update(context, store);

      expect(JSON.parse(addedFiles.get("widgets/qa_a/nav.json")!.toString("utf-8"))).toEqual(["tr-qa-a"]);
      expect(JSON.parse(addedFiles.get("widgets/qa_b/nav.json")!.toString("utf-8"))).toEqual(["tr-qa-b"]);
      expect(store.environmentIdByTrId).toHaveBeenCalledWith("tr-qa-a");
      expect(store.environmentIdByTrId).toHaveBeenCalledWith("tr-qa-b");
    });

    it("should write timeline entries with environment ids and display names when two ids share one display name", async () => {
      const qaATestResult = {
        id: "tr-qa-a",
        name: "qa a test",
        status: "passed",
        environment: "QA",
        labels: [
          { name: "host", value: "shared-host" },
          { name: "thread", value: "thread-1" },
        ],
        parameters: [],
        links: [],
        steps: [],
        hidden: false,
        start: 1,
        stop: 11,
        sourceMetadata: { readerId: "system", metadata: {} },
      } as TestResult;
      const qaBTestResult = {
        id: "tr-qa-b",
        name: "qa b test",
        status: "failed",
        environment: "QA",
        labels: [
          { name: "host", value: "shared-host" },
          { name: "thread", value: "thread-1" },
        ],
        parameters: [],
        links: [],
        steps: [],
        hidden: false,
        start: 2,
        stop: 22,
        sourceMetadata: { readerId: "system", metadata: {} },
      } as TestResult;
      const testResults = [qaATestResult, qaBTestResult];
      const addedFiles = new Map<string, Buffer>();
      const reportFiles: ReportFiles = {
        addFile: vi.fn(async (path: string, data: Buffer) => {
          addedFiles.set(path, data);
          return path;
        }),
      };

      const store: AllureStore = {
        metadataByKey: vi.fn().mockResolvedValue(undefined),
        allEnvironments: vi.fn().mockResolvedValue(["QA"]),
        allEnvironmentIdentities: vi.fn().mockResolvedValue([
          { id: "qa_a", name: "QA" },
          { id: "qa_b", name: "QA" },
        ] satisfies EnvironmentIdentity[]),
        allAttachments: vi.fn().mockResolvedValue([]),
        allTestResults: vi.fn(async (options?: { includeHidden?: boolean; filter?: (tr: TestResult) => boolean }) => {
          const trs = options?.filter ? testResults.filter(options.filter) : testResults;
          return trs;
        }),
        testResultsByEnvironment: vi.fn().mockResolvedValue([qaATestResult, qaBTestResult]),
        testResultsByEnvironmentId: vi
          .fn()
          .mockImplementation(async (environmentId: string) =>
            environmentId === "qa_a" ? [qaATestResult] : environmentId === "qa_b" ? [qaBTestResult] : [],
          ),
        environmentIdByTrId: vi.fn().mockImplementation(async (trId: string) => (trId === "tr-qa-a" ? "qa_a" : "qa_b")),
        testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => getTestResultsStats(testResults, filter)),
        allTestEnvGroups: vi.fn().mockResolvedValue([]),
        allGlobalAttachments: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue(undefined),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        qualityGateResults: vi.fn().mockResolvedValue([]),
        qualityGateResultsByEnv: vi.fn().mockResolvedValue({}),
        qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
        fixturesByTrId: vi.fn().mockResolvedValue([]),
        historyByTrId: vi.fn().mockResolvedValue([]),
        retriesByTrId: vi.fn().mockResolvedValue([]),
        attachmentsByTrId: vi.fn().mockResolvedValue([]),
        allVariables: vi.fn().mockResolvedValue([]),
        envVariables: vi.fn().mockResolvedValue([]),
        envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
        allHistoryDataPoints: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironment: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironmentId: vi.fn().mockResolvedValue([]),
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
        charts: [],
      });

      await plugin.start(context);
      await plugin.update(context, store);

      expect(JSON.parse(addedFiles.get("widgets/timeline.json")!.toString("utf-8"))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "tr-qa-a",
            environment: "qa_a",
            environmentName: "QA",
          }),
          expect.objectContaining({
            id: "tr-qa-b",
            environment: "qa_b",
            environmentName: "QA",
          }),
        ]),
      );
    });
  });

  describe("single file mode", () => {
    const makeSingleFileStore = (testResults: TestResult[]): AllureStore =>
      ({
        metadataByKey: vi.fn().mockResolvedValue(undefined),
        allEnvironments: vi.fn().mockResolvedValue(["default"]),
        allEnvironmentIdentities: vi
          .fn()
          .mockResolvedValue([{ id: "default", name: "default" } satisfies EnvironmentIdentity]),
        allAttachments: vi.fn().mockResolvedValue([]),
        allTestResults: vi.fn(async (options?: { includeHidden?: boolean; filter?: (tr: TestResult) => boolean }) => {
          const trs = options?.filter ? testResults.filter(options.filter) : testResults;
          return trs;
        }),
        testResultsByEnvironment: vi.fn().mockResolvedValue(testResults),
        testResultsByEnvironmentId: vi.fn().mockResolvedValue(testResults),
        environmentIdByTrId: vi.fn().mockResolvedValue("default"),
        testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => getTestResultsStats(testResults, filter)),
        allTestEnvGroups: vi.fn().mockResolvedValue([]),
        allGlobalAttachments: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue(undefined),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        qualityGateResults: vi.fn().mockResolvedValue([]),
        qualityGateResultsByEnv: vi.fn().mockResolvedValue({}),
        qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
        fixturesByTrId: vi.fn().mockResolvedValue([]),
        historyByTrId: vi.fn().mockResolvedValue([]),
        retriesByTrId: vi.fn().mockResolvedValue([]),
        attachmentsByTrId: vi.fn().mockResolvedValue([]),
        allVariables: vi.fn().mockResolvedValue([]),
        envVariables: vi.fn().mockResolvedValue([]),
        envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
        allHistoryDataPoints: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironment: vi.fn().mockResolvedValue([]),
        allHistoryDataPointsByEnvironmentId: vi.fn().mockResolvedValue([]),
        allNewTestResults: vi.fn().mockResolvedValue([]),
        attachmentContentById: vi.fn().mockResolvedValue(undefined),
      }) as unknown as AllureStore;

    const makeSingleFileContext = (reportFiles: ReportFiles): PluginContext => ({
      id: "Awesome",
      publish: true,
      state: {} as PluginContext["state"],
      allureVersion: "3.0.0",
      reportUuid: "report-uuid",
      reportName: "Test report",
      reportFiles,
      output: "/tmp/out",
    });

    /** Extract the allureReportData key→base64-value map embedded in index.html */
    const extractEmbeddedData = (html: string): Record<string, string> => {
      const data: Record<string, string> = {};
      const pattern = /d\(("(?:[^"\\]|\\.)*"),("(?:[^"\\]|\\.)*")\)/g;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(html)) !== null) {
        data[JSON.parse(match[1]) as string] = JSON.parse(match[2]) as string;
      }

      return data;
    };

    it("should embed all required widget files as valid base64 JSON with posix keys", async () => {
      const testResults: TestResult[] = [
        {
          id: "tr-1",
          name: "passed test",
          status: "passed",
          environment: "default",
          labels: [{ name: "tag", value: "smoke" }],
        },
      ] as TestResult[];

      const addedFiles = new Map<string, Buffer>();
      const reportFiles: ReportFiles = {
        addFile: vi.fn(async (path: string, data: Buffer) => {
          addedFiles.set(path, data);
          return path;
        }),
      };

      const plugin = new AwesomePlugin({ singleFile: true });

      await plugin.start(makeSingleFileContext(reportFiles));
      await plugin.done(makeSingleFileContext(reportFiles), makeSingleFileStore(testResults));

      const indexHtml = addedFiles.get("index.html")?.toString("utf-8") ?? "";

      expect(indexHtml, "index.html must be generated").not.toBe("");

      const embeddedData = extractEmbeddedData(indexHtml);

      // All keys must use normalized report paths and POSIX separators.
      for (const key of Object.keys(embeddedData)) {
        expect(key).toMatch(/^(widgets|data)\//);
        expect(key).not.toContain("\\");
        expect(key).not.toMatch(/^(widgets|data)[^/]/);
      }

      // Required widget files must be present
      const requiredKeys = [
        "widgets/nav.json",
        "widgets/default/tree.json",
        "widgets/default/nav.json",
        "widgets/environments.json",
        "widgets/statistic.json",
        "widgets/globals.json",
      ];

      for (const key of requiredKeys) {
        expect(Object.keys(embeddedData), `"${key}" must be embedded`).toContain(key);
      }

      // Every value must decode to valid JSON
      for (const [key, value] of Object.entries(embeddedData)) {
        const decoded = Buffer.from(value, "base64").toString("utf-8");

        expect(() => JSON.parse(decoded), `"${key}" value must be valid JSON`).not.toThrow();
      }

      // widgets/environments.json must include "default"
      const envsRaw = embeddedData["widgets/environments.json"];
      const envs = JSON.parse(Buffer.from(envsRaw, "base64").toString("utf-8")) as string[];

      expect(envs).toContain("default");

      // data test results file for the test must be present
      expect(Object.keys(embeddedData).some((k) => k.startsWith("data/test-results/"))).toBe(true);
    });
  });
});
