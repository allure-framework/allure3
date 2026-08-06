/* eslint-disable @typescript-eslint/unbound-method */
import { ChartType } from "@allurereport/charts-api";
import type { AttachmentLink, EnvironmentIdentity, TestFixtureResult, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { ResultFile } from "@allurereport/plugin-api";
import type { AwesomeQualityGateResults, AwesomeSearchDocument, AwesomeTestResult } from "@allurereport/web-awesome";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateAllCharts,
  generateAttachmentsFiles,
  generateKnownIssues,
  generateGlobals,
  generateQualityGateResults,
  generateSearchIndex,
  generateTestResults,
  generateTree,
  getRunSummary,
  applyKnownIssuesToTestResults,
} from "../src/generators.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("generators");
  await label("coverage", "report-output");
});
import type { AwesomeDataWriter } from "../src/writer.js";

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
    known: false,
    isRetry: false,
    sourceMetadata: { readerId: "system", metadata: {} },
    parameters: [],
    links: [],
    steps: [],
  }) as TestResult;

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

describe("generateTestResults", () => {
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
        retriesByTrId: new Map([["tr-1", []]]),
      }),
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store, [testResult]);

    expect(converted?.setup.map(({ name }) => name)).toEqual(["beforeAll", "beforeEach"]);
    expect(converted?.teardown.map(({ name }) => name)).toEqual(["afterEach", "afterAll"]);
  });
});

describe("generateKnownIssues", () => {
  it("should attach known issue data to converted test results by historyId", () => {
    const tests = [
      {
        id: "tr-1",
        historyId: "history-1",
        name: "known test",
        status: "failed",
        isRetry: false,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
      },
    ] as AwesomeTestResult[];

    applyKnownIssuesToTestResults(tests, [
      {
        historyId: "history-1",
        reason: "BUG-1 checkout issue",
        links: [{ name: "BUG-1", url: "https://example.com/BUG-1", type: "issue" }],
      },
    ]);

    expect(tests[0]?.knownIssues).toEqual([
      expect.objectContaining({
        reason: "BUG-1 checkout issue",
        links: [{ name: "BUG-1", url: "https://example.com/BUG-1", type: "issue" }],
      }),
    ]);
  });

  it("should attach multiple known issues to a converted test result by historyId", () => {
    const tests = [
      {
        id: "tr-1",
        historyId: "history-1",
        name: "known test",
        status: "failed",
        isRetry: false,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
      },
    ] as AwesomeTestResult[];

    applyKnownIssuesToTestResults(tests, [
      {
        historyId: "history-1",
        reason: "BUG-1 checkout issue",
      },
      {
        historyId: "history-1",
        reason: "BUG-2 payment issue",
      },
    ]);

    expect(tests[0]?.knownIssues).toEqual([
      expect.objectContaining({ reason: "BUG-1 checkout issue" }),
      expect.objectContaining({ reason: "BUG-2 payment issue" }),
    ]);
  });

  it("should write issues grouped with visible linked test results", async () => {
    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const knownIssue = {
      id: "issue-1",
      reason: "BUG-1 checkout issue",
      links: [{ name: "BUG-1", url: "https://example.com/BUG-1", type: "issue" }],
    };
    const secondKnownIssue = {
      id: "issue-2",
      reason: "BUG-2 payment issue",
      links: [{ name: "BUG-2", url: "https://example.com/BUG-2", type: "issue" }],
    };
    const tests = [
      {
        id: "tr-1",
        historyId: "history-1",
        name: "first known test",
        status: "failed",
        start: 2,
        isRetry: false,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
        knownIssues: [knownIssue, secondKnownIssue],
      },
      {
        id: "tr-2",
        historyId: "history-2",
        name: "second known test",
        status: "broken",
        start: 1,
        isRetry: false,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
        knownIssues: [knownIssue],
      },
      {
        id: "tr-retry",
        historyId: "history-retry",
        name: "retry known test",
        status: "failed",
        isRetry: true,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
        knownIssues: [knownIssue],
      },
    ] as AwesomeTestResult[];

    await generateKnownIssues(writer, tests, "widgets/known-issues.json");

    expect(writer.writeWidget).toHaveBeenCalledWith("widgets/known-issues.json", expect.any(Object));
    expect(writtenWidgets.get("widgets/known-issues.json")).toEqual({
      issues: [knownIssue, secondKnownIssue],
      testResultsByIssueId: {
        "issue-1": [
          expect.objectContaining({ id: "tr-2", name: "second known test" }),
          expect.objectContaining({ id: "tr-1", name: "first known test" }),
        ],
        "issue-2": [expect.objectContaining({ id: "tr-1", name: "first known test" })],
      },
    });
  });
});

describe("generateGlobals", () => {
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
      historyId: "history-visible",
      name: "visible test",
      fullName: "com.acme.VisibleTest.visible",
      status: "failed",
      isRetry: false,
      flaky: false,
      muted: false,
      known: false,
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
      categories: [{ name: "Product defects" }],
    } as AwesomeTestResult;
    const retryTest = {
      ...visibleTest,
      id: "tr-retry",
      isRetry: true,
      name: "retry test",
    } as AwesomeTestResult;

    await generateSearchIndex(writer, [visibleTest, retryTest], "qa/search-index.json");

    expect(writer.writeWidget).toHaveBeenCalledWith("qa/search-index.json", expect.any(Array));
    const documents = writtenWidgets.get("qa/search-index.json") as AwesomeSearchDocument[];

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: "tr-visible",
      nodeId: "tr-visible",
      name: "visible test",
      fullName: "com.acme.VisibleTest.visible",
      historyId: "history-visible",
      labels: "owner:Igor Martynov Igor Martynov feature:Checkout Checkout tag:smoke smoke",
      owner: "Igor Martynov",
      tags: "smoke",
      parameters: "browser:chromium browser chromium token",
      categories: "Product defects",
      statusMessage: "Assertion error: Expected 1 to be 2",
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
    ] as AwesomeTestResult[];

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

    const results = writtenWidgets.get("quality-gate.json") as AwesomeQualityGateResults;
    const [result] = results.default;

    expect(result.testResults).toEqual(["tr-related", "tr-related", "tr-missing"]);
    expect(Object.keys(result.testResultsTree?.leavesById ?? {})).toEqual(["tr-related"]);
    expect(result.testResultsTree?.leavesById["tr-related"]).toMatchObject({
      nodeId: "tr-related",
      name: "related test",
      status: "failed",
    });
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

describe("generateTree", () => {
  it("should write known flag to tree leaves", async () => {
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
        id: "tr-known",
        historyId: "history-known",
        name: "known test",
        status: "failed",
        isRetry: false,
        flaky: false,
        known: true,
        retry: false,
        labels: [],
        groupedLabels: {},
      },
      {
        id: "tr-unknown",
        historyId: "history-unknown",
        name: "unknown test",
        status: "failed",
        isRetry: false,
        flaky: false,
        known: false,
        retry: false,
        labels: [],
        groupedLabels: {},
      },
    ] as AwesomeTestResult[];

    await generateTree(writer, "default/tree.json", [], tests);

    const tree = writtenWidgets.get("default/tree.json") as {
      leavesById: Record<string, { known: boolean }>;
    };

    expect(tree.leavesById["tr-known"]).toMatchObject({ known: true });
    expect(tree.leavesById["tr-unknown"]).toMatchObject({ known: false });
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
        id: "written",
        ext: ".txt",
        originalFileName: "written.txt",
        name: "written",
        missed: false,
        used: true,
      },
    ];

    const result = await generateAttachmentsFiles(
      writer,
      attachmentLinks,
      vi.fn(async (id: string) => (id === "written" ? writtenContent : undefined)),
    );

    expect(writer.writeAttachment).toHaveBeenCalledTimes(1);
    expect(writer.writeAttachment).toHaveBeenCalledWith("written.txt", writtenContent);
    expect(result).toEqual(new Map([["written", "written.txt"]]));
  });
});
