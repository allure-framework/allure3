/* eslint-disable @typescript-eslint/unbound-method */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChartType } from "@allurereport/charts-api";
import type {
  AttachmentLink,
  EnvironmentIdentity,
  Statistic,
  HistoryTestResult,
  TestFixtureResult,
  TestResult,
} from "@allurereport/core-api";
import type {
  AllureStore,
  ReportQualityGateResults,
  ReportSearchDocument,
  ReportTestResult,
  PluginContext,
  ResultFile,
} from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateAllCharts,
  generateAttachmentsFiles,
  generateGlobals,
  generateMetricsWidget,
  generateQualityGateResults,
  generateResolutionCategories,
  generateSearchIndex,
  generateStatistic,
  generateTestResults,
  generateTree,
  getRunSummary,
} from "../src/generators.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("generators");
  await label("coverage", "report-output");
});
import type { AwesomeDataWriter } from "../src/writer.js";
import { FileSystemReportDataWriter } from "../src/writer.js";

const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
      if (!acc[test.status]) {
        acc[test.status] = 0;
      }
      acc[test.status]++;
      return acc;
    },
    { total: trsToProcess.length } as Record<string, number>,
  );
};

describe("getRunSummary", () => {
  it("should return undefined for empty result input", () => {
    expect(getRunSummary([])).toBeUndefined();
  });

  it("should derive launch interval from valid result timings", () => {
    expect(
      getRunSummary([
        { start: 1000, stop: 2000 },
        { start: 500, stop: 2500 },
        { start: 1500, stop: 1800 },
      ]),
    ).toEqual({
      start: 500,
      stop: 2500,
      duration: 2000,
    });
  });

  it("should ignore results without valid timing data", () => {
    expect(
      getRunSummary([
        { start: undefined, stop: 2000 },
        { start: 1000, stop: undefined },
      ]),
    ).toBeUndefined();
  });
});

const mockTestResult = (id: string, name: string, status: TestResult["status"]): TestResult =>
  ({
    id,
    name,
    status,
    labels: [],
    flaky: false,
    muted: false,
    isRetry: false,
    sourceMetadata: { readerId: "system", metadata: {} },
    parameters: [],
    links: [],
    steps: [],
  }) as TestResult;

const createWriter = () => {
  const writtenWidgets = new Map<string, unknown>();
  const writer: AwesomeDataWriter = {
    writeData: vi.fn().mockResolvedValue(undefined),
    writeWidget: vi.fn(async (fileName: string, data: unknown) => {
      writtenWidgets.set(fileName, data);
    }),
    writeTestCase: vi.fn().mockResolvedValue(undefined),
    writeAttachment: vi.fn().mockResolvedValue(undefined),
  };

  return { writer, writtenWidgets };
};

const mockFixtureResult = (
  id: string,
  type: TestFixtureResult["type"],
  name: string,
  start: number,
): TestFixtureResult =>
  ({
    id,
    testResultIds: ["tr-1"],
    type,
    name,
    status: "passed",
    start,
    duration: 1,
    steps: [],
    sourceMetadata: { readerId: "system", metadata: {} },
  }) as TestFixtureResult;

describe("generateAllCharts", () => {
  it("should filter chart data when filter is passed in options", async () => {
    const testResults: TestResult[] = [
      mockTestResult("tr-1", "passed test", "passed"),
      mockTestResult("tr-2", "failed test", "failed"),
      mockTestResult("tr-3", "another passed test", "passed"),
    ];

    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    const store: AllureStore = {
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      allEnvironments: vi.fn().mockResolvedValue(["default"]),
      allEnvironmentIdentities: vi
        .fn()
        .mockResolvedValue([{ id: "default", name: "default" } satisfies EnvironmentIdentity]),
      allAttachments: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue(testResults),
      testResultsByEnvironment: vi.fn().mockResolvedValue(testResults),
      testResultsByEnvironmentId: vi.fn().mockResolvedValue(testResults),
      environmentIdByTrId: vi.fn().mockResolvedValue("default"),
      testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => getTestResultsStats(testResults, filter)),
      allTestEnvGroups: vi.fn().mockResolvedValue([]),
      allGlobalAttachments: vi.fn().mockResolvedValue([]),
      globalExitCode: vi.fn().mockResolvedValue(undefined),
      allGlobalErrors: vi.fn().mockResolvedValue([]),
      qualityGateResults: vi.fn().mockResolvedValue([]),
      qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
      fixturesByTrId: vi.fn().mockResolvedValue([]),
      historyByTrId: vi.fn().mockResolvedValue([]),
      retriesByTrId: vi.fn().mockResolvedValue([]),
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      allVariables: vi.fn().mockResolvedValue([]),
      envVariables: vi.fn().mockResolvedValue([]),
      envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
      allMetrics: vi.fn().mockResolvedValue([]),
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
      reportFiles: {} as PluginContext["reportFiles"],
      output: "/tmp/out",
    };

    await generateAllCharts(writer, store, { filter: (tr) => tr.status === "passed" }, context);

    expect(writer.writeWidget).toHaveBeenCalledWith("charts.json", expect.any(Object));

    interface ChartItem {
      type: string;
      data: Record<string, number>;
    }
    const chartsData = writtenWidgets.get("charts.json") as { general: Record<string, ChartItem> };
    expect(chartsData).toBeDefined();
    expect(chartsData.general).toBeDefined();

    // Find Current Status chart (uses statistic as data); filtered results should show only passed
    const chartEntries = Object.values(chartsData.general);
    const currentStatusChart = chartEntries.find((chart) => chart.type === ChartType.CurrentStatus);
    expect(currentStatusChart).toBeDefined();
    expect(currentStatusChart!.data).toEqual({
      passed: 2,
      total: 2,
    });
    // Failed test must be excluded by filter
    expect(currentStatusChart!.data.failed).toBeUndefined();
  });

  it("should keep env-specific chart statistics separated by environment id when display names collide", async () => {
    const qaATestResult = {
      ...mockTestResult("tr-qa-a", "qa a test", "passed"),
      environment: "QA",
    };
    const qaBTestResult = {
      ...mockTestResult("tr-qa-b", "qa b test", "failed"),
      environment: "QA",
    };
    const testResults = [qaATestResult, qaBTestResult];
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    const store: AllureStore = {
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      allEnvironments: vi.fn().mockResolvedValue(["QA"]),
      allEnvironmentIdentities: vi.fn().mockResolvedValue([
        { id: "qa_a", name: "QA" },
        { id: "qa_b", name: "QA" },
      ] satisfies EnvironmentIdentity[]),
      allAttachments: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue(testResults),
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
      qualityGateResultsByEnvironmentId: vi.fn().mockResolvedValue({}),
      fixturesByTrId: vi.fn().mockResolvedValue([]),
      historyByTrId: vi.fn().mockResolvedValue([]),
      retriesByTrId: vi.fn().mockResolvedValue([]),
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      allVariables: vi.fn().mockResolvedValue([]),
      envVariables: vi.fn().mockResolvedValue([]),
      envVariablesByEnvironmentId: vi.fn().mockResolvedValue([]),
      allMetrics: vi.fn().mockResolvedValue([]),
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
      reportFiles: {} as PluginContext["reportFiles"],
      output: "/tmp/out",
    };

    await generateAllCharts(writer, store, { charts: [{ type: ChartType.CurrentStatus }] }, context);

    const chartsData = writtenWidgets.get("charts.json") as {
      byEnv: Record<string, Record<string, { type: string; data: Record<string, number> }>>;
    };
    const qaAChart = Object.values(chartsData.byEnv.qa_a).find((chart) => chart.type === ChartType.CurrentStatus);
    const qaBChart = Object.values(chartsData.byEnv.qa_b).find((chart) => chart.type === ChartType.CurrentStatus);

    expect(qaAChart?.data).toEqual({
      passed: 1,
      total: 1,
    });
    expect(qaBChart?.data).toEqual({
      failed: 1,
      total: 1,
    });
  });
});

describe("generateMetricsWidget", () => {
  it("should write current metrics and history metrics when current metrics exist", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allMetrics: vi.fn().mockResolvedValue([
        {
          key: "generate.total.avgMs",
          value: 200,
          id: "generate-total",
          start: 0,
          stop: 1,
          source: "generate-total-performance.json",
          title: "Generate total",
          unit: "ms",
          better: "lower",
        },
      ]),
      allHistoryDataPoints: vi.fn().mockResolvedValue([
        {
          uuid: "history-1",
          name: "Previous report",
          timestamp: 1_700_000_000_000,
          url: "https://example.com/report",
          metrics: {
            "generate.total.avgMs": 250,
          },
        },
        {
          uuid: "history-empty",
          name: "Empty report",
          timestamp: 1_700_000_001_000,
          metrics: {},
        },
        {
          uuid: "report-uuid",
          name: "Current report",
          timestamp: 1_700_000_002_000,
          metrics: {
            "generate.total.avgMs": 200,
          },
        },
      ]),
    } as unknown as AllureStore;

    await expect(generateMetricsWidget(writer, store, "report-uuid")).resolves.toBe(true);

    expect(writtenWidgets.get("metrics.json")).toEqual({
      current: [
        {
          key: "generate.total.avgMs",
          value: 200,
          id: "generate-total",
          start: 0,
          stop: 1,
          title: "Generate total",
          unit: "ms",
          source: "generate-total-performance.json",
          better: "lower",
        },
      ],
      history: [
        {
          uuid: "history-1",
          name: "Previous report",
          timestamp: 1_700_000_000_000,
          url: "https://example.com/report",
          metrics: {
            "generate.total.avgMs": 250,
          },
        },
      ],
    });
  });

  it("should not write metrics widget when current metrics are absent", async () => {
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allMetrics: vi.fn().mockResolvedValue([]),
      allHistoryDataPoints: vi.fn().mockResolvedValue([
        {
          uuid: "history-1",
          name: "Previous report",
          timestamp: 1_700_000_000_000,
          metrics: {
            "generate.total.avgMs": 250,
          },
        },
      ]),
    } as unknown as AllureStore;

    await expect(generateMetricsWidget(writer, store, "report-uuid")).resolves.toBe(false);

    expect(writer.writeWidget).not.toHaveBeenCalled();
  });
});

describe("generateTestResults", () => {
  const historyFixture = (history: HistoryTestResult[]) => {
    const testResult = mockTestResult("tr-1", "current test", "passed");
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([["tr-1", []]]),
        fixturesByTrId: new Map([["tr-1", []]]),
        historyByTrId: new Map([["tr-1", history]]),
        resolutionIssuesByTrId: new Map([["tr-1", undefined]]),
        retriesByTrId: new Map([["tr-1", []]]),
      }),
      resolutionIssueByTestResultId: vi.fn().mockResolvedValue(undefined),
    } as unknown as AllureStore;

    return { testResult, writer, store };
  };

  it("should use the selected history provider resolver", async () => {
    const item: HistoryTestResult = Object.freeze({
      id: "old-result",
      name: "historical test",
      status: "passed",
      url: "https://bucket.example/runs/42/",
    });
    const resolveHistoryUrl = vi.fn(() => "https://bucket.example/runs/42/awesome/index.html#old-result");
    const { writer, store, testResult } = historyFixture([item]);

    const [converted] = await generateTestResults(writer, store, [testResult], {
      pluginId: "awesome",
      resolveHistoryUrl,
    });

    // history is resolved when it is read, so read it before looking at the resolver's calls
    expect(converted.history[0].url).toBe("https://bucket.example/runs/42/awesome/index.html#old-result");
    expect(resolveHistoryUrl).toHaveBeenCalledWith(item.url, "awesome", item.id);
    expect(item.url).toBe("https://bucket.example/runs/42/");
  });

  it("should sort setup and teardown fixtures by start time", async () => {
    const testResult = mockTestResult("tr-1", "test", "passed");
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([["tr-1", []]]),
        fixturesByTrId: new Map([
          [
            "tr-1",
            [
              mockFixtureResult("before-each", "before", "beforeEach", 200),
              mockFixtureResult("before-all", "before", "beforeAll", 100),
              mockFixtureResult("after-all", "after", "afterAll", 400),
              mockFixtureResult("after-each", "after", "afterEach", 300),
            ],
          ],
        ]),
        historyByTrId: new Map([["tr-1", []]]),
        resolutionIssuesByTrId: new Map([["tr-1", undefined]]),
        retriesByTrId: new Map([["tr-1", []]]),
      }),
      resolutionIssueByTestResultId: vi.fn().mockResolvedValue(undefined),
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store, [testResult], { pluginId: "awesome" });

    expect(converted?.setup.map(({ name }) => name)).toEqual(["beforeAll", "beforeEach"]);
    expect(converted?.teardown.map(({ name }) => name)).toEqual(["afterEach", "afterAll"]);
  });

  it("should include the matched resolution issue in generated test result JSON", async () => {
    const testResult = {
      ...mockTestResult("tr-1", "failed test", "failed"),
      resolution: "issue",
      resolutionComment: "BUG-1 still fails in checkout",
    } satisfies TestResult;
    const { writer } = createWriter();
    const resolutionIssue = {
      id: "BUG-1",
      type: "jira",
      comment: "BUG-1 still fails in checkout",
      link: {
        name: "Jira BUG-1",
        url: "https://jira.example/browse/BUG-1",
        type: "jira",
      },
    };
    const resolutionIssueByTestResultId = vi.fn().mockResolvedValue(undefined);
    const store = {
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([["tr-1", []]]),
        fixturesByTrId: new Map([["tr-1", []]]),
        historyByTrId: new Map([["tr-1", []]]),
        resolutionIssuesByTrId: new Map([["tr-1", resolutionIssue]]),
        retriesByTrId: new Map([["tr-1", []]]),
      }),
      resolutionIssueByTestResultId,
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store, [testResult], { pluginId: "awesome" });

    expect(resolutionIssueByTestResultId).not.toHaveBeenCalled();
    expect(converted).toMatchObject({
      resolution: "issue",
      resolutionComment: "BUG-1 still fails in checkout",
      resolutionIssue: {
        id: "BUG-1",
        type: "jira",
        comment: "BUG-1 still fails in checkout",
        link: {
          name: "Jira BUG-1",
          url: "https://jira.example/browse/BUG-1",
          type: "jira",
        },
      },
    });
  });

  it("should fall back to per-result resolution issue lookup when related data does not include batch issues", async () => {
    const testResult = {
      ...mockTestResult("tr-1", "failed test", "failed"),
      resolution: "issue",
    } satisfies TestResult;
    const { writer } = createWriter();
    const resolutionIssue = {
      id: "BUG-1",
      type: "jira",
    };
    const resolutionIssueByTestResultId = vi.fn().mockResolvedValue(resolutionIssue);
    const store = {
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([["tr-1", []]]),
        fixturesByTrId: new Map([["tr-1", []]]),
        historyByTrId: new Map([["tr-1", []]]),
        retriesByTrId: new Map([["tr-1", []]]),
      }),
      resolutionIssueByTestResultId,
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store, [testResult], { pluginId: "awesome" });

    expect(resolutionIssueByTestResultId).toHaveBeenCalledWith("tr-1");
    expect(converted.resolutionIssue).toEqual(resolutionIssue);
  });

  it("should distinguish retries with changed and unchanged significant statuses", async () => {
    const changed = mockTestResult("tr-changed", "changed", "passed");
    const unchanged = mockTestResult("tr-unchanged", "unchanged", "failed");
    const { writer } = createWriter();
    const store = {
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([
          ["tr-changed", []],
          ["tr-unchanged", []],
        ]),
        fixturesByTrId: new Map([
          ["tr-changed", []],
          ["tr-unchanged", []],
        ]),
        historyByTrId: new Map([
          ["tr-changed", []],
          ["tr-unchanged", []],
        ]),
        resolutionIssuesByTrId: new Map([
          ["tr-changed", undefined],
          ["tr-unchanged", undefined],
        ]),
        retriesByTrId: new Map([
          ["tr-changed", [mockTestResult("retry-changed", "changed", "failed")]],
          ["tr-unchanged", [mockTestResult("retry-unchanged", "unchanged", "failed")]],
        ]),
      }),
      resolutionIssueByTestResultId: vi.fn().mockResolvedValue(undefined),
    } as unknown as AllureStore;

    const converted = await generateTestResults(writer, store, [changed, unchanged], { pluginId: "awesome" });

    expect(converted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tr-changed",
          retry: true,
          retriesCount: 1,
          retriesStatusChange: true,
        }),
        expect.objectContaining({
          id: "tr-unchanged",
          retry: true,
          retriesCount: 1,
          retriesStatusChange: false,
        }),
      ]),
    );
  });
});

describe("generateTree", () => {
  it("should include resolution category in tree leaves", async () => {
    const { writer, writtenWidgets } = createWriter();
    const tests = [
      {
        ...mockTestResult("tr-issue", "issue test", "failed"),
        groupedLabels: {},
        resolution: "issue",
        retriesStatusChange: true,
      } as ReportTestResult,
      {
        ...mockTestResult("tr-clean", "clean test", "passed"),
        groupedLabels: {},
      } as ReportTestResult,
      {
        ...mockTestResult("tr-unresolved", "unresolved failure", "failed"),
        groupedLabels: {},
      } as ReportTestResult,
    ];

    await generateTree(writer, "tree.json", [], tests);

    const tree = writtenWidgets.get("tree.json") as {
      leavesById: Record<string, { resolution?: string; resolutionStatus?: string; retriesStatusChange?: boolean }>;
    };

    expect(tree.leavesById["tr-issue"]).toMatchObject({
      resolution: "issue",
      resolutionStatus: "issue",
      retriesStatusChange: true,
    });
    expect(tree.leavesById["tr-clean"]?.resolution).toBeUndefined();
    expect(tree.leavesById["tr-clean"]?.resolutionStatus).toBeUndefined();
    expect(tree.leavesById["tr-unresolved"]).toMatchObject({ resolutionStatus: "none" });
  });

  it("should include non-empty redacted parameter values in tree leaves", async () => {
    const { writer, writtenWidgets } = createWriter();
    const tests = [
      {
        ...mockTestResult("tr-parameterized", "parameterized test", "passed"),
        groupedLabels: {},
        parameters: [
          { name: "visible", value: "value", hidden: false, masked: false, excluded: false },
          { name: "empty", value: "", hidden: false, masked: false, excluded: false },
          { name: "token", value: "secret-token", hidden: false, masked: true, excluded: false },
          { name: "internal", value: "hidden-value", hidden: true, masked: false, excluded: false },
        ],
      } as ReportTestResult,
      {
        ...mockTestResult("tr-without-parameters", "plain test", "passed"),
        groupedLabels: {},
      } as ReportTestResult,
    ];

    await generateTree(writer, "tree.json", [], tests);

    const tree = writtenWidgets.get("tree.json") as {
      leavesById: Record<string, { parameters?: string[] }>;
    };
    const serializedTree = JSON.stringify(tree);

    expect(tree.leavesById["tr-parameterized"]?.parameters).toEqual(["value", "<masked>"]);
    expect(tree.leavesById["tr-without-parameters"]?.parameters).toBeUndefined();
    expect(serializedTree).not.toContain("secret-token");
    expect(serializedTree).not.toContain("hidden-value");
  });
});

describe("generateResolutionCategories", () => {
  it("should write resolution groups with related non-retry test results", async () => {
    const { writer, writtenWidgets } = createWriter();
    const tests = [
      {
        ...mockTestResult("tr-issue-1", "checkout fails", "failed"),
        retryHash: "history-1",
        resolution: "issue",
        resolutionComment: "Checkout discount is not applied",
        resolutionIssue: {
          id: "BUG-1",
          type: "jira",
          comment: "Checkout discount is not applied",
          link: {
            name: "Jira BUG-1",
            url: "https://jira.example/browse/BUG-1",
            type: "jira",
          },
        },
        retriesStatusChange: true,
      } as ReportTestResult,
      {
        ...mockTestResult("tr-issue-2", "checkout fails again", "failed"),
        retryHash: "history-2",
        resolution: "issue",
        resolutionComment: "Checkout discount is not applied",
        resolutionIssue: {
          id: "BUG-1",
          type: "jira",
          comment: "Checkout discount is not applied",
          link: {
            name: "Jira BUG-1",
            url: "https://jira.example/browse/BUG-1",
            type: "jira",
          },
        },
      } as ReportTestResult,
      {
        ...mockTestResult("tr-muted", "muted failure", "broken"),
        resolution: "muted",
        resolutionComment: "Muted while infra is unstable",
      } as ReportTestResult,
      {
        ...mockTestResult("tr-accepted", "accepted failure", "failed"),
        resolution: "accepted",
        resolutionComment: "Accepted risk for the release",
      } as ReportTestResult,
      {
        ...mockTestResult("tr-retry", "retry issue", "failed"),
        isRetry: true,
        resolution: "issue",
        resolutionIssue: { id: "BUG-2", type: "jira" },
      } as ReportTestResult,
      mockTestResult("tr-clean", "clean test", "passed") as ReportTestResult,
    ];

    await generateResolutionCategories(writer, tests);

    expect(writtenWidgets.get("resolution-categories.json")).toEqual({
      groups: [
        {
          id: "issue:BUG-1",
          resolution: "issue",
          name: "BUG-1",
          comment: "Checkout discount is not applied",
          issue: {
            id: "BUG-1",
            type: "jira",
            comment: "Checkout discount is not applied",
            link: {
              name: "Jira BUG-1",
              url: "https://jira.example/browse/BUG-1",
              type: "jira",
            },
          },
          testResults: [
            expect.objectContaining({
              nodeId: "tr-issue-1",
              id: "history-1",
              resolution: "issue",
              retriesStatusChange: true,
              groupOrder: 1,
            }),
            expect.objectContaining({ nodeId: "tr-issue-2", id: "history-2", resolution: "issue", groupOrder: 2 }),
          ],
        },
        {
          id: "muted:Muted while infra is unstable",
          resolution: "muted",
          name: "Muted while infra is unstable",
          comment: "Muted while infra is unstable",
          issue: undefined,
          testResults: [expect.objectContaining({ nodeId: "tr-muted", resolution: "muted" })],
        },
        {
          id: "accepted:Accepted risk for the release",
          resolution: "accepted",
          name: "Accepted risk for the release",
          comment: "Accepted risk for the release",
          issue: undefined,
          testResults: [expect.objectContaining({ nodeId: "tr-accepted", resolution: "accepted" })],
        },
      ],
    });
  });
});

describe("generateStatistic", () => {
  it("should write pie chart data from active statistics without changing raw statistics", async () => {
    const { writer, writtenWidgets } = createWriter();
    const stats: Statistic = { total: 3, passed: 1, failed: 2 };
    const activeStats: Statistic = { total: 2, passed: 1, failed: 1 };

    await generateStatistic(writer, {
      stats,
      statsByEnv: new Map(),
      pieStats: activeStats,
      envs: [],
    });

    expect(writtenWidgets.get("statistic.json")).toEqual(stats);
    expect(writtenWidgets.get("pie_chart.json")).toMatchObject({
      percentage: 50,
      slices: [
        expect.objectContaining({ status: "failed", count: 1 }),
        expect.objectContaining({ status: "passed", count: 1 }),
      ],
    });
  });
});

describe("generateGlobals", () => {
  it("should write duplicate global destinations once while preserving payload entries", async () => {
    const attachment = { id: "shared", ext: ".txt", originalFileName: "shared.txt", missed: false, used: true };
    const attachments = Array.from({ length: 65 }, () => attachment);
    const content = { kind: "attachment" } as ResultFile;
    const writer: AwesomeDataWriter = {
      writeData: vi.fn(),
      writeWidget: vi.fn(),
      writeTestCase: vi.fn(),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    await generateGlobals(writer, {
      globalAttachments: attachments,
      globalAttachmentsByEnv: { qa: attachments },
      contentFunction: async () => content,
    });

    expect(writer.writeAttachment).toHaveBeenCalledExactlyOnceWith("shared.txt", content);
    expect(writer.writeWidget).toHaveBeenCalledExactlyOnceWith("globals.json", {
      errors: [],
      attachments,
      attachmentsByEnv: { qa: attachments },
    });
  });

  it("should keep grouped globals by environment and exclude unwritten attachments from grouped payloads", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writtenContent = { kind: "attachment" } as any;
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    await generateGlobals(writer, {
      globalErrors: [{ message: "QA error", environment: "QA" }],
      globalErrorsByEnv: {
        qa_env: [{ message: "QA error", environment: "QA" }],
      },
      globalAttachments: [
        { id: "written", ext: ".txt", originalFileName: "written.txt", missed: false, used: true, environment: "QA" },
        {
          id: "missing",
          ext: ".txt",
          originalFileName: "missing.txt",
          missed: false,
          used: true,
          environment: "QA",
        },
      ],
      globalAttachmentsByEnv: {
        qa_env: [
          { id: "written", ext: ".txt", originalFileName: "written.txt", missed: false, used: true, environment: "QA" },
          {
            id: "missing",
            ext: ".txt",
            originalFileName: "missing.txt",
            missed: false,
            used: true,
            environment: "QA",
          },
        ],
      },
      contentFunction: vi.fn(async (id: string) => (id === "written" ? writtenContent : undefined)) as any,
    });

    expect(writer.writeAttachment).toHaveBeenCalledTimes(1);
    expect(writer.writeAttachment).toHaveBeenCalledWith("written.txt", writtenContent);

    expect(writtenWidgets.get("globals.json")).toEqual({
      attachments: [
        {
          id: "written",
          ext: ".txt",
          originalFileName: "written.txt",
          missed: false,
          used: true,
          environment: "QA",
        },
      ],
      attachmentsByEnv: {
        qa_env: [
          {
            id: "written",
            ext: ".txt",
            originalFileName: "written.txt",
            missed: false,
            used: true,
            environment: "QA",
          },
        ],
      },
      errors: [{ message: "QA error", environment: "QA" }],
      errorsByEnv: {
        qa_env: [{ message: "QA error", environment: "QA" }],
      },
    });
  });
});

describe("generateSearchIndex", () => {
  it("should write searchable fields and skip retries", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const visibleTest = {
      id: "tr-visible",
      retryHash: "history-visible",
      name: "visible test",
      fullName: "com.acme.VisibleTest.visible",
      status: "failed",
      isRetry: false,
      flaky: false,
      muted: false,
      labels: [
        { name: "owner", value: "Igor Martynov" },
        { name: "feature", value: "Checkout" },
        { name: "tag", value: "smoke" },
        { name: "ignored", value: "not searchable" },
      ],
      parameters: [
        { name: "browser", value: "chromium", hidden: false, masked: false, excluded: false },
        { name: "token", value: "secret-token", hidden: false, masked: true, excluded: false },
        { name: "internal", value: "hidden-value", hidden: true, masked: false, excluded: false },
      ],
      groupedLabels: {
        owner: ["Igor Martynov"],
        feature: ["Checkout"],
      },
      links: [{ name: "Issue 42", url: "https://example.com/ISSUE-42", type: "issue" }],
      error: {
        message: "Assertion error: Expected 1 to be 2",
      },
      errors: [{ message: "Assertion error: Expected 1 to be 2" }, { message: "Second soft assertion failed" }],
      categories: [{ name: "Product defects" }],
    } as ReportTestResult;
    const retryTest = {
      ...visibleTest,
      id: "tr-retry",
      isRetry: true,
      name: "retry test",
    } as ReportTestResult;

    await generateSearchIndex(writer, [visibleTest, retryTest], "qa/search-index.json");

    expect(writer.writeWidget).toHaveBeenCalledWith("qa/search-index.json", expect.any(Array));
    const documents = writtenWidgets.get("qa/search-index.json") as ReportSearchDocument[];

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: "tr-visible",
      nodeId: "tr-visible",
      name: "visible test",
      fullName: "com.acme.VisibleTest.visible",
      retryHash: "history-visible",
      labels: "owner:Igor Martynov Igor Martynov feature:Checkout Checkout tag:smoke smoke",
      owner: "Igor Martynov",
      tags: "smoke",
      parameters: "browser:chromium browser chromium token",
      categories: "Product defects",
      statusMessage: "Assertion error: Expected 1 to be 2 Second soft assertion failed",
      links: "Issue 42 https://example.com/ISSUE-42 issue",
    });
    expect(documents[0]?.labels).not.toContain("ignored");
    expect(documents[0]?.parameters).not.toContain("secret-token");
    expect(documents[0]?.parameters).not.toContain("hidden-value");
  });
});

describe("generateQualityGateResults", () => {
  it("should embed a tree containing only related test results", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const tests = [
      {
        ...mockTestResult("tr-related", "related test", "failed"),
        groupedLabels: {},
      },
      {
        ...mockTestResult("tr-unrelated", "unrelated test", "passed"),
        groupedLabels: {},
      },
    ] as ReportTestResult[];

    await generateQualityGateResults(
      writer,
      {
        default: [
          {
            rule: "maxFailures",
            success: false,
            expected: 0,
            actual: 1,
            message: "Too many failures",
            testResults: ["tr-related", "tr-related", "tr-missing"],
          },
        ],
      },
      { tests },
    );

    const results = writtenWidgets.get("quality-gate.json") as ReportQualityGateResults;
    const [result] = results.default;

    expect(result.testResults).toEqual(["tr-related", "tr-related", "tr-missing"]);
    expect(Object.keys(result.testResultsTree?.leavesById ?? {})).toEqual(["tr-related"]);
    expect(result.testResultsTree?.leavesById["tr-related"]).toMatchObject({
      nodeId: "tr-related",
      name: "related test",
      status: "failed",
    });
  });

  it("should expose the severity label on tree leaves and omit it when there is none", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const tests = [
      {
        ...mockTestResult("tr-blocker", "blocker test", "failed"),
        groupedLabels: { severity: ["blocker"] },
      },
      {
        ...mockTestResult("tr-no-severity", "test without severity", "failed"),
        groupedLabels: {},
      },
    ] as AwesomeTestResult[];

    await generateQualityGateResults(
      writer,
      {
        default: [
          {
            rule: "maxFailures",
            success: false,
            expected: 0,
            actual: 2,
            message: "Too many failures",
            testResults: ["tr-blocker", "tr-no-severity"],
          },
        ],
      },
      { tests },
    );

    const results = writtenWidgets.get("quality-gate.json") as AwesomeQualityGateResults;
    const leavesById = results.default[0].testResultsTree?.leavesById ?? {};

    expect(leavesById["tr-blocker"]).toMatchObject({ severity: "blocker" });
    expect(leavesById["tr-no-severity"]).not.toHaveProperty("severity");
  });

  it("should omit the tree when no related test result can be resolved", async () => {
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    await generateQualityGateResults(writer, {
      default: [
        {
          rule: "maxFailures",
          success: false,
          expected: 0,
          actual: 0,
          message: "Too many failures",
          testResults: [],
        },
      ],
    });

    expect(writer.writeWidget).toHaveBeenCalledWith("quality-gate.json", {
      default: [expect.not.objectContaining({ testResultsTree: expect.anything() })],
    });
  });
});

describe("generateAttachmentsFiles", () => {
  it("should skip missed attachments and keep writing later available attachments", async () => {
    const writtenContent = { kind: "attachment" } as ResultFile;
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const attachmentLinks: AttachmentLink[] = [
      {
        id: "missed",
        ext: ".txt",
        originalFileName: "missed.txt",
        name: "missed",
        missed: true,
        used: true,
      },
      {
        id: "missing-content",
        ext: ".txt",
        originalFileName: "missing-content.txt",
        name: "missing content",
        missed: false,
        used: true,
      },
      {
        id: "written",
        ext: ".txt",
        originalFileName: "written.txt",
        name: "written",
        missed: false,
        used: true,
      },
    ];

    const contentFunction = vi.fn(async (id: string) => (id === "written" ? writtenContent : undefined));
    const result = await generateAttachmentsFiles(writer, attachmentLinks, contentFunction);

    expect(contentFunction).not.toHaveBeenCalledWith("missed");
    expect(writer.writeAttachment).toHaveBeenCalledTimes(1);
    expect(writer.writeAttachment).toHaveBeenCalledWith("written.txt", writtenContent);
    expect(result).toEqual(new Map([["written", "written.txt"]]));
  });
});

describe.each(["attachments", "globals"] as const)("concurrent %s writing", (kind) => {
  it("should write attachment bytes to a real filesystem output directory", async () => {
    const output = await mkdtemp(join(tmpdir(), "awesome concurrent output "));
    try {
      const writer = new FileSystemReportDataWriter(output);
      const attachments: AttachmentLink[] = Array.from({ length: 65 }, (_, index) => ({
        id: `attachment-${index}`,
        ext: ".txt",
        originalFileName: `attachment-${index}.txt`,
        name: `attachment ${index}`,
        missed: false,
        used: true,
      }));
      const contentFunction = async (id: string): Promise<ResultFile> => ({
        readContent: async () => undefined,
        getOriginalFileName: () => `${id}.txt`,
        getExtension: () => ".txt",
        getContentType: () => "text/plain",
        getContentLength: () => Buffer.byteLength(id),
        asBuffer: async () => Buffer.from(id),
        asJson: async () => undefined,
        asUtf8String: async () => id,
        writeTo: async (path) => writeFile(path, id),
      });
      if (kind === "attachments") {
        await generateAttachmentsFiles(writer, attachments, contentFunction);
      } else {
        await generateGlobals(writer, { globalAttachments: attachments, contentFunction });
        expect(JSON.parse(await readFile(join(output, "widgets", "globals.json"), "utf8"))).toEqual({
          errors: [],
          attachments,
        });
      }
      for (const { id, ext } of attachments) {
        expect(await readFile(join(output, "data", "attachments", `${id}${ext}`), "utf8")).toBe(id);
      }
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it("should limit writes to 8 and preserve input order when writes finish in reverse order", async () => {
    const attachments: AttachmentLink[] = Array.from({ length: 9 }, (_, index) => ({
      id: `attachment-${index}`,
      ext: ".txt",
      originalFileName: `attachment-${index}.txt`,
      name: `attachment ${index}`,
      missed: false,
      used: true,
    }));
    const content = { kind: "attachment" } as ResultFile;
    const pendingWrites: (() => void)[] = [];
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn(() => new Promise<void>((resolve) => pendingWrites.push(resolve))),
    };
    const contentFunction = vi.fn(async () => content);
    const generation =
      kind === "attachments"
        ? generateAttachmentsFiles(writer, attachments, contentFunction)
        : generateGlobals(writer, {
            globalAttachments: attachments,
            globalAttachmentsByEnv: { qa: attachments },
            contentFunction,
          });

    await vi.waitUntil(() => pendingWrites.length === 8);
    expect(pendingWrites).toHaveLength(8);
    expect(contentFunction).toHaveBeenCalledTimes(8);
    expect(writer.writeWidget).not.toHaveBeenCalled();
    pendingWrites
      .slice()
      .reverse()
      .forEach((resolve) => resolve());
    await vi.waitUntil(() => pendingWrites.length === 9);
    expect(pendingWrites).toHaveLength(9);
    pendingWrites[8]();
    const result = await generation;

    expect(vi.mocked(writer.writeAttachment).mock.calls.map(([src]) => src)).toEqual(
      attachments.map(({ id, ext }) => `${id}${ext}`),
    );
    if (kind === "attachments") {
      expect([...(result as Map<string, string>)]).toEqual(attachments.map(({ id, ext }) => [id, `${id}${ext}`]));
    } else {
      expect(writer.writeWidget).toHaveBeenCalledExactlyOnceWith("globals.json", {
        errors: [],
        attachments,
        attachmentsByEnv: { qa: attachments },
      });
    }
  });

  it("should propagate attachment write failures", async () => {
    const attachment: AttachmentLink = {
      id: "failed",
      ext: ".txt",
      originalFileName: "failed.txt",
      name: "failed",
      missed: false,
      used: true,
    };
    const error = new Error("write failed");
    const writer: AwesomeDataWriter = {
      writeData: vi.fn(),
      writeWidget: vi.fn(),
      writeTestCase: vi.fn(),
      writeAttachment: vi.fn().mockRejectedValue(error),
    };
    const contentFunction = async () => ({ kind: "attachment" }) as ResultFile;
    const generation =
      kind === "attachments"
        ? generateAttachmentsFiles(writer, [attachment], contentFunction)
        : generateGlobals(writer, { globalAttachments: [attachment], contentFunction });

    await expect(generation).rejects.toBe(error);
    expect(writer.writeWidget).not.toHaveBeenCalled();
  });
});
