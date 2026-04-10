import type { AttachmentLink, Statistic, TestError, TestResult } from "@allurereport/core-api";
import type { AllureStore, QualityGateValidationResult, RealtimeSubscriber } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";

import { ProgressConsolePresenter, resolveProgressConsoleMode } from "../src/index.js";

const createStream = ({ isTTY = false }: { isTTY?: boolean } = {}) => {
  const chunks: string[] = [];

  return {
    isTTY,
    write: (chunk: string) => {
      chunks.push(chunk);
      return true;
    },
    read: () => chunks.join(""),
  };
};

const createRealtime = () => {
  const testListeners: Array<(testResultIds: string[]) => Promise<void>> = [];
  const globalErrorListeners: Array<(error: TestError) => Promise<void>> = [];
  const qualityGateListeners: Array<(results: QualityGateValidationResult[]) => Promise<void>> = [];

  const subscriber: RealtimeSubscriber = {
    onTestResults: (listener) => {
      testListeners.push(listener);
      return () => {};
    },
    onGlobalError: (listener) => {
      globalErrorListeners.push(listener);
      return () => {};
    },
    onQualityGateResults: (listener) => {
      qualityGateListeners.push(listener);
      return () => {};
    },
    onGlobalAttachment: () => () => {},
    onGlobalExitCode: () => () => {},
    onTestFixtureResults: () => () => {},
    onAttachmentFiles: () => () => {},
  };

  return {
    subscriber,
    emitTestResults: async (testResultIds: string[]) => {
      for (const listener of testListeners) {
        await listener(testResultIds);
      }
    },
    emitGlobalError: async (error: TestError) => {
      for (const listener of globalErrorListeners) {
        await listener(error);
      }
    },
    emitQualityGateResults: async (results: QualityGateValidationResult[]) => {
      for (const listener of qualityGateListeners) {
        await listener(results);
      }
    },
  };
};

const createStore = (params: {
  testResults?: TestResult[];
  stats?: Statistic;
  retriesByTrId?: Record<string, TestResult[]>;
  globalErrors?: TestError[];
  globalAttachments?: AttachmentLink[];
  attachmentContents?: Record<string, string>;
}) => {
  const {
    testResults = [],
    stats = { total: testResults.length },
    retriesByTrId = {},
    globalErrors = [],
    globalAttachments = [],
    attachmentContents = {},
  } = params;
  const testResultsById = new Map(testResults.map((testResult) => [testResult.id, testResult]));

  return {
    testResultById: async (id: string) => testResultsById.get(id),
    testsStatistic: async () => stats,
    allTestResults: async () => testResults,
    retriesByTr: async (testResult: TestResult) => retriesByTrId[testResult.id] ?? [],
    allGlobalErrors: async () => globalErrors,
    allGlobalAttachments: async () => globalAttachments,
    attachmentContentById: async (id: string) =>
      attachmentContents[id] === undefined
        ? undefined
        : {
            asUtf8String: async () => attachmentContents[id],
          },
  } as AllureStore;
};

describe("resolveProgressConsoleMode", () => {
  it("should default to rich", () => {
    expect(resolveProgressConsoleMode(undefined, false)).toBe("rich");
  });

  it("should map --silent to silent mode", () => {
    expect(resolveProgressConsoleMode(undefined, true)).toBe("silent");
  });

  it("should reject combining explicit console mode with --silent", () => {
    expect(() => resolveProgressConsoleMode("summary", true)).toThrow("Cannot combine --console with --silent");
  });

  it("should reject unknown console modes", () => {
    expect(() => resolveProgressConsoleMode("loud", false)).toThrow('Unknown console mode "loud"');
  });
});

describe("ProgressConsolePresenter", () => {
  it("should print progress and failed or skipped highlights in rich mode", async () => {
    const stdout = createStream();
    const stderr = createStream();
    const testResults: TestResult[] = [
      {
        id: "failed",
        name: "failing test",
        fullName: "suite failing test",
        status: "failed",
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        sourceMetadata: { readerId: "reader", metadata: {} },
        error: { message: "boom" },
      },
      {
        id: "skipped",
        name: "skipped test",
        fullName: "suite skipped test",
        status: "skipped",
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        sourceMetadata: { readerId: "reader", metadata: {} },
      },
    ];
    const store = createStore({
      testResults,
      stats: { total: 2, failed: 1, skipped: 1 },
    });
    const realtime = createRealtime();
    const presenter = new ProgressConsolePresenter({
      mode: "rich",
      stdout,
      stderr,
    });

    await presenter.attach(store, realtime.subscriber);
    await realtime.emitTestResults(["failed", "skipped"]);

    expect(stdout.read()).toContain("Allure live:");
    expect(stdout.read()).toContain("FAIL suite failing test");
    expect(stdout.read()).toContain("SKIP suite skipped test");
    expect(stderr.read()).toBe("");
  });

  it("should restore the live progress line after a rich mode highlight on TTY output", async () => {
    const stdout = createStream({ isTTY: true });
    const stderr = createStream();
    const testResults: TestResult[] = [
      {
        id: "failed",
        name: "failing test",
        fullName: "suite failing test",
        status: "failed",
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        sourceMetadata: { readerId: "reader", metadata: {} },
        error: { message: "boom" },
      },
    ];
    const store = createStore({
      testResults,
      stats: { total: 1, failed: 1 },
    });
    const realtime = createRealtime();
    const presenter = new ProgressConsolePresenter({
      mode: "rich",
      stdout,
      stderr,
    });

    await presenter.attach(store, realtime.subscriber);
    await realtime.emitTestResults(["failed"]);

    expect(stdout.read()).toContain("FAIL suite failing test");
    expect(stdout.read()).toMatch(/FAIL suite failing test.*Allure live: .*total 1/s);
  });

  it("should surface runner errors and partial runtime review in errors mode", async () => {
    const stdout = createStream();
    const stderr = createStream();
    const globalErrors = [{ message: "Suite load failed", trace: "Cannot import module" }];
    const store = createStore({
      testResults: [],
      globalErrors,
    });
    const realtime = createRealtime();
    const presenter = new ProgressConsolePresenter({
      mode: "errors",
      stdout,
      stderr,
    });

    await presenter.attach(store, realtime.subscriber);
    await realtime.emitGlobalError(globalErrors[0]);
    await presenter.printFinalSummary({ store });

    expect(stderr.read()).toContain("Runner error:");
    expect(stdout.read()).toContain("Allure run summary");
    expect(stdout.read()).toContain("Partial runtime review:");
    expect(stdout.read()).toContain("Suite load failed - Cannot import module");
  });

  it("should include rerun recovery and quality gate details in the final summary", async () => {
    const stdout = createStream();
    const stderr = createStream();
    const finalResult: TestResult = {
      id: "passed",
      name: "recovered test",
      fullName: "suite recovered test",
      status: "passed",
      duration: 1200,
      flaky: false,
      muted: false,
      known: false,
      hidden: false,
      labels: [],
      parameters: [],
      links: [],
      steps: [],
      sourceMetadata: { readerId: "reader", metadata: {} },
    };
    const store = createStore({
      testResults: [finalResult],
      stats: { total: 1, passed: 1 },
      retriesByTrId: {
        passed: [
          {
            ...finalResult,
            id: "retry-1",
            status: "failed",
            error: { message: "first attempt failed" },
          },
        ],
      },
    });
    const presenter = new ProgressConsolePresenter({
      mode: "summary",
      stdout,
      stderr,
    });

    presenter.logRerunStart(1, [
      {
        ...finalResult,
        id: "failed-in-rerun",
        status: "failed",
      },
    ]);
    await presenter.printFinalSummary({
      store,
      qualityGateResults: [
        {
          success: false,
          expected: 0,
          actual: 1,
          rule: "maxFailures",
          message: "expected no failures, got 1",
        },
      ],
    });

    expect(stdout.read()).toContain("Recovered on rerun: 1");
    expect(stdout.read()).toContain("Quality gate:");
    expect(stdout.read()).toContain("expected no failures, got 1");
  });

  it("should surface partial runtime review from actionable stderr even when logical tests passed", async () => {
    const stdout = createStream();
    const stderr = createStream();
    const store = createStore({
      testResults: [
        {
          id: "passed",
          name: "passing test",
          fullName: "suite passing test",
          status: "passed",
          flaky: false,
          muted: false,
          known: false,
          hidden: false,
          labels: [],
          parameters: [],
          links: [],
          steps: [],
          sourceMetadata: { readerId: "reader", metadata: {} },
        },
      ],
      stats: { total: 1, passed: 1 },
      globalAttachments: [
        {
          id: "stderr-1",
          originalFileName: "stderr.txt",
          contentType: "text/plain",
          ext: "txt",
          used: true,
          missed: false,
        },
      ],
      attachmentContents: {
        "stderr-1": 'xcrun: error: unable to find utility "xcresulttool", not a developer tool or in PATH\n',
      },
    });
    const presenter = new ProgressConsolePresenter({
      mode: "summary",
      stdout,
      stderr,
    });

    await presenter.printFinalSummary({ store });

    expect(stdout.read()).toContain("Allure run summary");
    expect(stdout.read()).toContain("Tests: 1 passed");
    expect(stdout.read()).toContain("Partial runtime review:");
    expect(stdout.read()).toContain("xcresulttool");
  });

  it("should mirror only raw output in pipe mode", () => {
    const stdout = createStream();
    const stderr = createStream();
    const presenter = new ProgressConsolePresenter({
      mode: "pipe",
      stdout,
      stderr,
    });

    presenter.handleProcessStdout("stdout from tests");
    presenter.handleProcessStderr("stderr from tests");

    expect(stdout.read()).toContain("stdout from tests");
    expect(stderr.read()).toContain("stderr from tests");
  });
});
