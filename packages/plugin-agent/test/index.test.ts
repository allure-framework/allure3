import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AttachmentLink, TestError, TestFixtureResult, TestResult, TestStepResult } from "@allurereport/core-api";
import type {
  AllureStore,
  ExitCode,
  PluginContext,
  QualityGateValidationResult,
  RealtimeListenerResult,
  RealtimeSubscriber,
  ResultFile,
} from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { attachment, step, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentExpectationsInput, AgentHumanReportStatus } from "../src/index.js";
import { AgentPlugin } from "../src/plugin.js";
import { attachJsonEvidence, attachTextEvidence } from "./evidence.js";

beforeEach(async () => {
  await story("index");
});
const createContext = (reportName: string = "Agent Report"): PluginContext =>
  ({
    reportName,
    reportUuid: "report-uuid",
  }) as PluginContext;

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult =>
  ({
    id: "tr-1",
    name: "should pass",
    fullName: "suite should pass",
    status: "passed",
    duration: 25,
    flaky: false,
    muted: false,
    known: false,
    isRetry: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    titlePath: ["suite", "should pass"],
    sourceMetadata: {
      readerId: "test",
      metadata: {},
    },
    ...overrides,
  }) as TestResult;

const createAttachment = (overrides: Partial<AttachmentLink> = {}): AttachmentLink =>
  ({
    id: "attachment-1",
    name: "artifact.txt",
    originalFileName: "artifact.txt",
    ext: ".txt",
    used: true,
    missed: false,
    contentType: "text/plain",
    ...overrides,
  }) as AttachmentLink;

const createFixture = (overrides: Partial<TestFixtureResult> = {}): TestFixtureResult =>
  ({
    id: "fixture-1",
    testResultIds: ["tr-1"],
    type: "before",
    name: "setup",
    status: "passed",
    steps: [],
    sourceMetadata: {
      readerId: "test",
      metadata: {},
    },
    ...overrides,
  }) as TestFixtureResult;

const createStore = (overrides: Partial<AllureStore> = {}): AllureStore =>
  ({
    allTestResults: vi.fn().mockResolvedValue([]),
    testsStatistic: vi.fn().mockResolvedValue({ total: 0 }),
    allGlobalAttachments: vi.fn().mockResolvedValue([]),
    allGlobalErrors: vi.fn().mockResolvedValue([]),
    globalExitCode: vi.fn().mockResolvedValue(undefined),
    qualityGateResults: vi.fn().mockResolvedValue([]),
    environmentIdByTrId: vi.fn().mockResolvedValue("default"),
    retriesByTr: vi.fn().mockResolvedValue([]),
    fixturesByTrId: vi.fn().mockResolvedValue([]),
    attachmentsByTrId: vi.fn().mockResolvedValue([]),
    attachmentContentById: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as AllureStore;

const createRealtimeSubscriber = () => {
  const listeners = {
    testResults: [] as Array<(trIds: string[]) => RealtimeListenerResult>,
    globalAttachments: [] as Array<(payload: { attachment: ResultFile; fileName?: string }) => RealtimeListenerResult>,
    globalErrors: [] as Array<(error: TestError) => RealtimeListenerResult>,
    globalExitCodes: [] as Array<(payload: ExitCode) => RealtimeListenerResult>,
    qualityGateResults: [] as Array<(payload: QualityGateValidationResult[]) => RealtimeListenerResult>,
  };

  const subscriber: RealtimeSubscriber = {
    onTestResults: vi.fn((listener: (trIds: string[]) => RealtimeListenerResult) => {
      listeners.testResults.push(listener);

      return () => {
        listeners.testResults = listeners.testResults.filter((candidate) => candidate !== listener);
      };
    }),
    onGlobalAttachment: vi.fn(
      (listener: (payload: { attachment: ResultFile; fileName?: string }) => RealtimeListenerResult) => {
        listeners.globalAttachments.push(listener);

        return () => {
          listeners.globalAttachments = listeners.globalAttachments.filter((candidate) => candidate !== listener);
        };
      },
    ),
    onGlobalError: vi.fn((listener: (error: TestError) => RealtimeListenerResult) => {
      listeners.globalErrors.push(listener);

      return () => {
        listeners.globalErrors = listeners.globalErrors.filter((candidate) => candidate !== listener);
      };
    }),
    onGlobalExitCode: vi.fn((listener: (payload: ExitCode) => RealtimeListenerResult) => {
      listeners.globalExitCodes.push(listener);

      return () => {
        listeners.globalExitCodes = listeners.globalExitCodes.filter((candidate) => candidate !== listener);
      };
    }),
    onQualityGateResults: vi.fn((listener: (payload: QualityGateValidationResult[]) => RealtimeListenerResult) => {
      listeners.qualityGateResults.push(listener);

      return () => {
        listeners.qualityGateResults = listeners.qualityGateResults.filter((candidate) => candidate !== listener);
      };
    }),
    onTestFixtureResults: vi.fn(() => () => {}),
    onAttachmentFiles: vi.fn(() => () => {}),
  };

  return {
    subscriber,
    emitTestResults: async (trIds: string[]) => {
      for (const listener of listeners.testResults) {
        await Promise.resolve(listener(trIds));
      }
    },
  };
};

const readText = async (path: string, contentType: string = "text/plain"): Promise<string> => {
  const content = await readFile(path, "utf-8");

  await attachTextEvidence(`agent artifact ${path}`, content, contentType);

  return content;
};

const readJson = async <T>(path: string): Promise<T> => {
  const value = JSON.parse(await readFile(path, "utf-8")) as T;

  await attachJsonEvidence(`parsed ${path}`, value);

  return value;
};

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const values = (await readFile(path, "utf-8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

  await attachJsonEvidence(`parsed ${path}`, values);

  return values;
};

type TestFindingLine = {
  schema_version?: string;
  check_id?: string;
  instance_id?: string;
  check_name: string;
  severity: "info" | "warning" | "high";
  impact?: "reject" | "iterate" | "advisory";
  subject: unknown;
  subject_ref?: string;
};

type AttachmentContentFixture = {
  content: string;
  fileName: string;
};

const createMeaningfulStep = (name: string = "assert expected behavior"): TestStepResult =>
  ({
    type: "step",
    name,
    parameters: [
      {
        name: "state",
        value: "verified",
      },
    ],
    status: "passed",
    steps: [],
  }) as TestStepResult;

const createStoreWithGlobalLogs = (
  overrides: Partial<AllureStore> = {},
  attachmentContents: Record<string, AttachmentContentFixture> = {},
): AllureStore => {
  const stdout = createAttachment({
    id: "global-stdout",
    name: "stdout.txt",
    originalFileName: "stdout.txt",
  });
  const contents = new Map<string, AttachmentContentFixture>([
    [
      stdout.id,
      {
        content: "stdout",
        fileName: "stdout.txt",
      },
    ],
    ...Object.entries(attachmentContents),
  ]);

  return createStore({
    ...overrides,
    allGlobalAttachments: overrides.allGlobalAttachments ?? vi.fn().mockResolvedValue([stdout]),
    attachmentContentById:
      overrides.attachmentContentById ??
      vi.fn().mockImplementation(async (id: string) => {
        const fixture = contents.get(id);

        return fixture ? new BufferResultFile(Buffer.from(fixture.content, "utf-8"), fixture.fileName) : undefined;
      }),
  });
};

const expectationOutputName = (field: string, suffix: string) => `${field.replace(/\./g, "-")}-${suffix}`;

describe("AgentPlugin", () => {
  let tempDir: string;

  const runInlineExpectationCase = async (params: {
    outputName: string;
    expectations: AgentExpectationsInput;
    testResult?: TestResult;
    environmentId?: string;
    attachments?: AttachmentLink[];
    attachmentContents?: Record<string, AttachmentContentFixture>;
  }) => {
    const outputDir = join(tempDir, params.outputName);
    const testResult =
      params.testResult ??
      createTestResult({
        id: "tr-expectation",
        historyId: "expectation-history",
        fullName: "suite expected behavior",
      });

    await new AgentPlugin({
      outputDir,
      expectations: { goal: "Verify expectation case", ...params.expectations },
    }).done(
      createContext(),
      createStoreWithGlobalLogs(
        {
          allTestResults: vi.fn().mockResolvedValue([testResult]),
          testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
          environmentIdByTrId: vi.fn().mockResolvedValue(params.environmentId ?? "default"),
          attachmentsByTrId: vi.fn().mockResolvedValue(params.attachments ?? []),
        },
        params.attachmentContents,
      ),
    );

    return {
      outputDir,
      findings: await readJsonl<TestFindingLine>(join(outputDir, "manifest", "findings.jsonl")),
    };
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "plugin-agent-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should do nothing when no output directory is configured", async () => {
    const store = createStore();
    const plugin = new AgentPlugin();

    await plugin.done(createContext(), store);

    expect(store.allTestResults).not.toHaveBeenCalled();
  });

  it("should create bootstrap files immediately when realtime agent mode starts", async () => {
    const outputDir = join(tempDir, "realtime-bootstrap");
    const realtime = createRealtimeSubscriber();

    await new AgentPlugin({ outputDir }).start(createContext(), createStore(), realtime.subscriber);

    const runManifest = await readJson<{
      phase: "running" | "done";
      paths: {
        test_events_manifest: string;
      };
    }>(join(outputDir, "manifest", "run.json"));
    const guide = await readText(join(outputDir, "AGENTS.md"), "text/markdown");
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");
    const testEvents = await readText(join(outputDir, "manifest", "test-events.jsonl"), "application/x-jsonlines");

    expect(runManifest.phase).toBe("running");
    expect(runManifest.paths.test_events_manifest).toBe("manifest/test-events.jsonl");
    expect(guide).toContain("manifest/test-events.jsonl");
    expect(indexContent).toContain("- Phase: running");
    expect(testEvents).toBe("");
  });

  it("should stream per-test markdown and event records before finalization", async () => {
    const outputDir = join(tempDir, "realtime-events");
    const realtime = createRealtimeSubscriber();
    const liveTest = createTestResult({
      id: "tr-live",
      historyId: "live-history",
      fullName: "suite live result",
    });
    let currentTests: TestResult[] = [];
    let currentStats = { total: 0 };
    const store = createStore({
      allTestResults: vi.fn().mockImplementation(async () => currentTests),
      testsStatistic: vi.fn().mockImplementation(async () => currentStats),
    });
    const plugin = new AgentPlugin({ outputDir });

    await plugin.start(createContext(), store, realtime.subscriber);

    currentTests = [liveTest];
    currentStats = { total: 1, passed: 1 };

    await realtime.emitTestResults(["tr-live"]);
    await realtime.emitTestResults(["tr-live"]);

    const runningManifest = await readJson<{
      phase: "running" | "done";
    }>(join(outputDir, "manifest", "run.json"));
    const testContent = await readText(join(outputDir, "tests", "default", "live-history.md"), "text/markdown");
    const eventLines = await readJsonl<{
      event_type: string;
      markdown_path?: string;
    }>(join(outputDir, "manifest", "test-events.jsonl"));

    expect(runningManifest.phase).toBe("running");
    expect(testContent).toContain("suite live result");
    expect(eventLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "test_completed",
          markdown_path: "tests/default/live-history.md",
        }),
        expect.objectContaining({
          event_type: "test_updated",
          markdown_path: "tests/default/live-history.md",
        }),
      ]),
    );

    await plugin.done(createContext(), store);

    const finalManifest = await readJson<{
      phase: "running" | "done";
    }>(join(outputDir, "manifest", "run.json"));
    const finalEvents = await readJsonl<{
      event_type: string;
    }>(join(outputDir, "manifest", "test-events.jsonl"));

    expect(finalManifest.phase).toBe("done");
    expect(finalEvents.at(-1)).toEqual(expect.objectContaining({ event_type: "run_finished" }));
  });

  it("should write output only when outputDir is configured", async () => {
    const optionDir = join(tempDir, "option-output");
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([createTestResult()]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    await new AgentPlugin({ outputDir: optionDir }).done(createContext(), store);

    await expect(stat(join(optionDir, "index.md"))).resolves.toBeTruthy();
    await expect(stat(join(optionDir, "AGENTS.md"))).resolves.toBeTruthy();
  });

  it.each([
    {
      name: "generated",
      status: {
        schema_version: "allure-agent-human-report/v1",
        mode: "auto",
        status: "generated",
        result_count: 1,
        threshold: 1000,
        path: "awesome/index.html",
        reports: [{ plugin_id: "awesome", path: "awesome/index.html" }],
        reason: null,
        error: null,
        generated_at: "2026-06-10T16:00:00.000Z",
      } satisfies AgentHumanReportStatus,
      expectedText: "- Path: [awesome/index.html](awesome/index.html)",
    },
    {
      name: "skipped",
      status: {
        schema_version: "allure-agent-human-report/v1",
        mode: "auto",
        status: "skipped",
        result_count: 1001,
        threshold: 1000,
        path: null,
        reports: [],
        reason: "result count 1001 exceeds threshold 1000",
        error: null,
      } satisfies AgentHumanReportStatus,
      expectedText: "- Reason: result count 1001 exceeds threshold 1000",
    },
    {
      name: "disabled",
      status: {
        schema_version: "allure-agent-human-report/v1",
        mode: "off",
        status: "disabled",
        result_count: null,
        threshold: 1000,
        path: null,
        reports: [],
        reason: "disabled by --report off",
        error: null,
      } satisfies AgentHumanReportStatus,
      expectedText: "- Reason: disabled by --report off",
    },
    {
      name: "failed",
      status: {
        schema_version: "allure-agent-human-report/v1",
        mode: "awesome",
        status: "failed",
        result_count: 1,
        threshold: 1000,
        path: null,
        reports: [],
        reason: null,
        error: "single-file report failed",
        errors: [{ plugin_id: "awesome", message: "single-file report failed" }],
      } satisfies AgentHumanReportStatus,
      expectedText: "- Error: single-file report failed",
    },
  ])("should write $name human report status to manifests and index", async ({ name, status, expectedText }) => {
    const outputDir = join(tempDir, `human-report-${name}`);

    await new AgentPlugin({ outputDir, humanReport: status }).done(createContext(), createStore());

    const runManifest = await readJson<{
      paths: {
        human_report_manifest: string | null;
      };
      human_report: AgentHumanReportStatus | null;
    }>(join(outputDir, "manifest", "run.json"));
    const humanReportManifest = await readJson<AgentHumanReportStatus>(
      join(outputDir, "manifest", "human-report.json"),
    );
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(runManifest.paths.human_report_manifest).toBe("manifest/human-report.json");
    expect(runManifest.human_report).toEqual(status);
    expect(humanReportManifest).toEqual(status);
    expect(indexContent).toContain("## Human Report");
    expect(indexContent).toContain(`- Status: ${status.status}`);
    expect(indexContent).toContain(`- Mode: ${status.mode}`);
    expect(indexContent).toContain(expectedText);
  });

  it("should clean only managed entries before writing", async () => {
    const outputDir = join(tempDir, "managed-cleanup");

    await mkdir(join(outputDir, "tests"), { recursive: true });
    await mkdir(join(outputDir, "artifacts"), { recursive: true });
    await writeFile(join(outputDir, "index.md"), "stale", "utf-8");
    await writeFile(join(outputDir, "AGENTS.md"), "stale", "utf-8");
    await writeFile(join(outputDir, "notes.txt"), "keep me", "utf-8");

    await new AgentPlugin({ outputDir }).done(createContext(), createStore());

    expect(await readText(join(outputDir, "notes.txt"))).toBe("keep me");
    expect(await readText(join(outputDir, "index.md"), "text/markdown")).toContain("# Agent Report");
    expect(await readText(join(outputDir, "AGENTS.md"), "text/markdown")).toContain("# AGENTS Guide");
  });

  it("should use historyId-based file names and fall back to the test result id", async () => {
    const outputDir = join(tempDir, "stable-names");
    const withHistoryId = createTestResult({
      id: "tr-history",
      historyId: "history-1",
      fullName: "suite history based",
    });
    const withoutHistoryId = createTestResult({
      id: "tr-fallback",
      historyId: undefined,
      name: "fallback name",
      fullName: "suite fallback name",
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([withHistoryId, withoutHistoryId]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 2, passed: 2 }),
      environmentIdByTrId: vi.fn().mockImplementation(async (id: string) => (id === "tr-history" ? "qa" : "default")),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    await expect(stat(join(outputDir, "tests", "qa", "history-1.md"))).resolves.toBeTruthy();
    await expect(stat(join(outputDir, "tests", "default", "tr-fallback.md"))).resolves.toBeTruthy();
  });

  it("should keep markdown text readable without over-escaping test identifiers", async () => {
    const outputDir = join(tempDir, "readable-markdown");
    const testResult = createTestResult({
      id: "tr-readable",
      name: "should keep markdown readable (v1)",
      fullName: "test/index.test.ts#AgentPlugin should keep markdown readable (v1)",
      historyId: "history.id#1",
      titlePath: ["test", "index.test.ts", "AgentPlugin"],
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");
    const testContent = await readText(join(outputDir, "tests", "default", "history.id_1.md"), "text/markdown");

    expect(indexContent).toContain("test/index.test.ts#AgentPlugin should keep markdown readable (v1)");
    expect(testContent).toContain("Name: should keep markdown readable (v1)");
    expect(testContent).toContain("Full Name: test/index.test.ts#AgentPlugin should keep markdown readable (v1)");
    expect(testContent).toContain("History ID: history.id#1");
    expect(testContent).not.toContain("\\.");
    expect(testContent).not.toContain("\\#");
    expect(testContent).not.toContain("\\(");
  });

  it("should fold retries into one logical file and suffix collisions", async () => {
    const outputDir = join(tempDir, "retries");
    const primary = createTestResult({
      id: "tr-primary",
      historyId: "shared-history",
      name: "primary",
      fullName: "suite primary",
      status: "failed",
      start: 300,
      error: {
        message: "primary failure",
      },
    });
    const retry = createTestResult({
      id: "tr-retry",
      historyId: "shared-history",
      name: "primary retry",
      fullName: "suite primary retry",
      isRetry: true,
      status: "broken",
      start: 200,
      error: {
        message: "retry failure",
      },
    });
    const sibling = createTestResult({
      id: "tr-sibling",
      historyId: "shared-history",
      name: "sibling",
      fullName: "suite sibling",
      status: "passed",
      start: 100,
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([primary, sibling]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 2, failed: 1, passed: 1 }),
      retriesByTr: vi.fn().mockImplementation(async (tr: TestResult) => (tr.id === "tr-primary" ? [retry] : [])),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const primaryContent = await readText(join(outputDir, "tests", "default", "shared-history.md"), "text/markdown");

    expect(primaryContent).toContain("## Retry 1");
    expect(primaryContent).toContain("retry failure");
    await expect(stat(join(outputDir, "tests", "default", "shared-history--tr-sibling.md"))).resolves.toBeTruthy();
  });

  it("should write index, AGENTS guide, and copied global stdout and stderr files", async () => {
    const outputDir = join(tempDir, "globals");
    const stdoutAttachment = createAttachment({
      id: "stdout",
      name: "stdout.txt",
      originalFileName: "random-stdout",
    });
    const stderrAttachment = createAttachment({
      id: "stderr",
      name: "stderr.txt",
      originalFileName: "random-stderr",
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([createTestResult()]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
      allGlobalAttachments: vi.fn().mockResolvedValue([stdoutAttachment, stderrAttachment]),
      attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "stdout") {
          return new BufferResultFile(Buffer.from("stdout content", "utf-8"), "stdout.txt");
        }

        if (id === "stderr") {
          return new BufferResultFile(Buffer.from("stderr content", "utf-8"), "stderr.txt");
        }

        return undefined;
      }),
      globalExitCode: vi.fn().mockResolvedValue({ actual: 1, original: 1 }),
      qualityGateResults: vi.fn().mockResolvedValue([
        {
          success: false,
          expected: 0,
          actual: 1,
          rule: "maxFailures",
          message: "Too many failures",
          environment: "default",
        },
      ]),
    });

    await new AgentPlugin({ outputDir }).done(createContext("My Report"), store);

    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(indexContent).toContain("# My Report");
    expect(indexContent).toContain("## Process Logs");
    expect(indexContent).not.toContain("## Global Artifacts");
    expect(indexContent).toContain("[stdout.txt](artifacts/global/stdout.txt)");
    expect(indexContent).toContain("[stderr.txt](artifacts/global/stderr.txt)");
    expect(indexContent).toContain("stdout.txt");
    expect(indexContent).toContain("stderr.txt");
    expect(indexContent).toContain("Too many failures");
    expect(await readText(join(outputDir, "artifacts", "global", "stdout.txt"))).toBe("stdout content");
    expect(await readText(join(outputDir, "artifacts", "global", "stderr.txt"))).toBe("stderr content");
    expect(await readText(join(outputDir, "AGENTS.md"), "text/markdown")).toContain("## Reading Order");
  });

  it("should generate standalone AGENTS guidance", async () => {
    const outputDir = join(tempDir, "standalone-agents-guide");
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([createTestResult()]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const agentsGuide = await readText(join(outputDir, "AGENTS.md"), "text/markdown");
    const runManifest = await readJson<{
      paths: Record<string, unknown>;
    }>(join(outputDir, "manifest", "run.json"));

    expect(agentsGuide).toContain("## Reading Order");
    expect(agentsGuide).toContain("## Command Task Map");
    expect(runManifest.paths).toEqual(expect.objectContaining({ index_md: "index.md", agents_md: "AGENTS.md" }));
  });

  it("should include downstream enrichment best practices in AGENTS.md", async () => {
    const outputDir = join(tempDir, "agents-guide");

    const guide = await step("render AGENTS guidance", async () => {
      await new AgentPlugin({ outputDir }).done(createContext(), createStore());

      return await readText(join(outputDir, "AGENTS.md"), "text/markdown");
    });

    await step("verify generated workflow guidance", async () => {
      await attachment(
        "verified AGENTS guidance sections",
        JSON.stringify(
          {
            sections: [
              "Agent Workflows",
              "Command Task Map",
              "Verification Standard",
              "Test Enrichment Best Practices",
            ],
            command: 'allure agent --goal <text> --expect-tests <count> --expect-test "<fullName>"',
          },
          null,
          2,
        ),
        "application/json",
      );
      expect(guide).toContain("## Agent Workflows");
      expect(guide).toContain("Use the smallest workflow that matches the task.");
      expect(guide).toContain("### Validate A Change");
      expect(guide).toContain("### Add Or Update Tests");
      expect(guide).toContain("### Review Existing Coverage");
      expect(guide).toContain("### Triage Failures");
      expect(guide).toContain("### Rerun A Prior Scope");
      expect(guide).toContain("### Improve Evidence Quality");
      expect(guide).toContain("### Recover Or Diagnose Agent Mode");
      expect(guide).toContain("Use when code or tests changed and you need a user-facing safety conclusion.");
      expect(guide).toContain("Commands:");
      expect(guide).toContain("Done when:");
      expect(guide).toContain("## Verification Standard");
      expect(guide).toContain("manifest/test-events.jsonl");
      expect(guide).toContain("allure agent latest");
      expect(guide).toContain("allure agent state-dir");
      expect(guide).toContain("allure agent select --latest");
      expect(guide).toContain("allure agent --rerun-latest");
      expect(guide).toContain("## Command Task Map");
      expect(guide).toContain("setup and capability-detection loop");
      expect(guide).toContain("output recovery loop");
      expect(guide).toContain("tooling diagnosis loop");
      expect(guide).toContain("rerun-planning loop");
      expect(guide).toContain("focused retry loop");
      expect(guide).toContain("state-control loop");
      expect(guide).toContain("--rerun-preset");
      expect(guide).toContain("instead of rebuilding runner-specific test names");
      expect(guide).toContain("allure agent --rerun-latest --rerun-preset failed -- <command>");
      expect(guide).toContain("--rerun-environment");
      expect(guide).toContain("--rerun-label");
      expect(guide).toContain("ALLURE_AGENT_STATE_DIR");
      expect(guide).toContain('allure agent --goal <text> --expect-tests <count> --expect-test "<fullName>"');
      expect(guide).toContain("print the `index.md` path");
      expect(guide).toContain(
        "If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.",
      );
      expect(guide).toContain("Use `allure agent` for smoke checks too, even when the change is small or mechanical.");
      expect(guide).toContain(
        "Only skip agent mode when it is impossible or when you are debugging agent mode itself.",
      );
      expect(guide).toContain(
        "For small mechanical changes, use this same workflow with narrower expectations rather than a separate shortcut.",
      );
      expect(guide).toContain("## Test Enrichment Best Practices");
      expect(guide).toContain("## Anti-Dummy Policy");
      expect(guide).toContain("## Acceptance Checklist");
      expect(guide).toContain("## Review Completeness");
      expect(guide).toContain("## Partial Runtime Review");
      expect(guide).toContain("teach `runCommand` to emit a step");
    });
  });

  it("should render fixtures, copy attachments, and keep missing attachments visible", async () => {
    const outputDir = join(tempDir, "attachments");
    const screenshot = createAttachment({
      id: "shot-1",
      name: "screenshot.png",
      originalFileName: "screenshot.png",
      ext: ".png",
      contentType: "image/png",
    });
    const fixtureLog = createAttachment({
      id: "fixture-log",
      name: "fixture.log",
      originalFileName: "fixture.log",
      ext: ".log",
      contentType: "text/plain",
    });
    const missingAttachment = createAttachment({
      id: "missing-attachment",
      name: "missing.txt",
      originalFileName: "missing.txt",
      missed: true,
    });
    const testSteps: TestStepResult[] = [
      {
        type: "step",
        name: "open page",
        parameters: [],
        status: "passed",
        steps: [
          {
            type: "attachment",
            link: screenshot,
          } as TestStepResult,
        ],
      } as TestStepResult,
      {
        type: "attachment",
        link: missingAttachment,
      } as TestStepResult,
    ];
    const fixtures = [
      createFixture({
        id: "before-1",
        name: "setup",
        steps: [
          {
            type: "attachment",
            link: fixtureLog,
          } as TestStepResult,
        ],
      }),
    ];
    const testResult = createTestResult({
      id: "tr-attachments",
      historyId: "artifact-history",
      fullName: "suite attachments",
      status: "failed",
      steps: testSteps,
      error: {
        message: "render error",
        trace: "stack trace",
      },
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1 }),
      attachmentsByTrId: vi.fn().mockResolvedValue([screenshot]),
      fixturesByTrId: vi.fn().mockResolvedValue(fixtures),
      attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "shot-1") {
          return new BufferResultFile(Buffer.from("png-bytes", "utf-8"), "screenshot.png");
        }

        if (id === "fixture-log") {
          return new BufferResultFile(Buffer.from("fixture log", "utf-8"), "fixture.log");
        }

        return undefined;
      }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const content = await readText(join(outputDir, "tests", "default", "artifact-history.md"), "text/markdown");

    expect(content).toContain("### Before Fixture: setup");
    expect(content).toContain("### Steps");
    expect(content).toContain("missing attachment");
    expect(content).toContain("screenshot.png");
    expect(content).toContain("fixture.log");
    expect(await readText(join(outputDir, "tests", "default", "artifact-history.assets", "screenshot.png"))).toBe(
      "png-bytes",
    );
    expect(await readText(join(outputDir, "tests", "default", "artifact-history.assets", "fixture.log"))).toBe(
      "fixture log",
    );
  });

  it("should write manifests, expected scope, and advisory findings", async () => {
    const outputDir = join(tempDir, "manifests");
    const expectationsPath = join(tempDir, "expected.yaml");
    const matching = createTestResult({
      id: "tr-match",
      historyId: "feature-a-history",
      name: "feature A should work",
      fullName: "feature A should work",
      duration: 180,
      labels: [
        {
          name: "feature",
          value: "feature-a",
        },
      ],
    });
    const forbidden = createTestResult({
      id: "tr-forbidden",
      historyId: "feature-b-history",
      name: "feature B should not run",
      fullName: "feature B should not run",
      duration: 35,
      labels: [
        {
          name: "feature",
          value: "feature-b",
        },
      ],
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([matching, forbidden]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 2, passed: 2 }),
      environmentIdByTrId: vi.fn().mockImplementation(async (id: string) => (id === "tr-match" ? "web" : "api")),
    });

    await writeFile(
      expectationsPath,
      `goal: Verify feature A
task_id: feature-a
expected:
  environments:
    - web
  full_name_prefixes:
    - feature A
  label_values:
    feature: feature-a
forbidden:
  full_names:
    - feature B should not run
  label_values:
    feature: feature-b
notes:
  - Only feature A tests should run
`,
      "utf-8",
    );

    await new AgentPlugin({
      outputDir,
      expectationsPath,
      command: "yarn test feature-a",
      agentName: "codex",
      loopId: "loop-1",
      conversationId: "conversation-1",
    }).done(createContext(), store);

    const runManifest = await readJson<{
      command: string;
      expectations_present: boolean;
      agent_context: {
        agent_name: string;
        loop_id: string;
        task_id: string;
        conversation_id: string;
      };
      paths: {
        expected_manifest: string;
      };
      check_summary: {
        total: number;
      };
    }>(join(outputDir, "manifest", "run.json"));
    const testsManifest = await readJsonl<{
      full_name: string;
      scope_match: "match" | "unexpected" | "forbidden" | "unknown";
    }>(join(outputDir, "manifest", "tests.jsonl"));
    const findingsManifest = await readJsonl<{
      check_name: string;
      severity: "info" | "warning" | "high";
      subject?: unknown;
      subject_ref?: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");
    const forbiddenContent = await readText(join(outputDir, "tests", "api", "feature-b-history.md"), "text/markdown");

    expect(runManifest.command).toBe("yarn test feature-a");
    expect(runManifest.expectations_present).toBe(true);
    expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
    expect(runManifest.agent_context).toEqual({
      agent_name: "codex",
      loop_id: "loop-1",
      task_id: "feature-a",
      conversation_id: "conversation-1",
    });
    expect(testsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          full_name: "feature A should work",
          scope_match: "match",
        }),
        expect.objectContaining({
          full_name: "feature B should not run",
          scope_match: "forbidden",
        }),
      ]),
    );
    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "forbidden-label-observed",
          severity: "high",
          subject_ref: "tests/api/feature-b-history.md",
        }),
        expect.objectContaining({
          check_name: "unexpected-environment",
          severity: "warning",
          subject_ref: "run",
        }),
      ]),
    );
    expect(runManifest.check_summary.total).toBeGreaterThan(0);
    expect(indexContent).toContain("## Expected Scope");
    expect(indexContent).toContain("Verify feature A");
    expect(indexContent).toContain("Only feature A tests should run");
    expect(indexContent).toContain("## Advisory Check Summary");
    expect(indexContent).toContain("## Needs Attention First");
    expect(forbiddenContent).toContain("## Expectation Comparison");
    expect(forbiddenContent).toContain("Scope Match: forbidden");
    expect(forbiddenContent).toContain("## Quality Findings");
    expect(await readText(join(outputDir, "manifest", "expected.json"), "application/json")).toContain(
      '"task_id": "feature-a"',
    );
  });

  it("should load inline expectations and report count and evidence gaps", async () => {
    const outputDir = join(tempDir, "inline-expectations");
    const matching = createTestResult({
      id: "tr-inline",
      historyId: "inline-history",
      name: "inline should be visible",
      fullName: "inline should be visible",
      labels: [
        {
          name: "feature",
          value: "inline",
        },
      ],
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([matching]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    const expectations = {
      goal: "Review inline expectations",
      expected: {
        test_count: 2,
        label_values: {
          feature: "inline",
        },
      },
      evidence: {
        min_steps: 1,
        min_attachments: 1,
        step_name_contains: ["assert expected behavior"],
        attachments: [
          {
            name: "evidence.json",
          },
        ],
      },
    };

    await new AgentPlugin({ outputDir, expectations }).done(createContext(), store);

    const expectedManifest = await readJson<{
      expected: {
        test_count: number;
      };
      evidence: {
        step_name_contains: string[];
      };
    }>(join(outputDir, "manifest", "expected.json"));
    const findingsManifest = await readJsonl<{
      check_name: string;
      severity: "info" | "warning" | "high";
      subject?: unknown;
      subject_ref?: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));
    const runManifest = await readJson<{
      expectations: {
        evidence: {
          step_name_contains: string[];
        };
      };
      expectation_result: {
        status: string;
        impact: string;
        recognized_control_count: number;
        summary: {
          expected_tests: number;
          observed_tests: number;
          evidence_mismatches: number;
        };
      };
    }>(join(outputDir, "manifest", "run.json"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(expectedManifest.expected.test_count).toBe(2);
    expect(expectedManifest.evidence.step_name_contains).toEqual(["assert expected behavior"]);
    expect(runManifest.expectations.evidence.step_name_contains).toEqual(["assert expected behavior"]);
    expect(runManifest.expectation_result.status).toBe("failed");
    expect(runManifest.expectation_result.impact).toBe("iterate");
    expect(runManifest.expectation_result.recognized_control_count).toBe(7);
    expect(runManifest.expectation_result.summary).toEqual(
      expect.objectContaining({
        expected_tests: 2,
        observed_tests: 1,
        evidence_mismatches: 4,
      }),
    );
    expect(indexContent).toContain("Expectations Source: CLI options");
    expect(indexContent).toContain("## Expectation Result");
    expect(indexContent).toContain("Status: failed");
    expect(indexContent).toContain("test count: 2");
    expect(indexContent).toContain("step contains: assert expected behavior");
    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema_version: "allure-agent-finding/v2",
          check_id: "expected-count-mismatch",
          check_name: "expected-count-mismatch",
          severity: "warning",
          impact: "iterate",
          subject_ref: "run",
        }),
        expect.objectContaining({
          check_name: "expected-step-containing-missing",
          severity: "warning",
          subject_ref: "tests/default/inline-history.md",
        }),
        expect.objectContaining({
          check_name: "insufficient-expected-steps",
          severity: "warning",
          subject_ref: "tests/default/inline-history.md",
        }),
        expect.objectContaining({
          check_name: "insufficient-expected-attachments",
          severity: "warning",
          subject_ref: "tests/default/inline-history.md",
        }),
        expect.objectContaining({
          check_name: "missing-expected-attachment",
          severity: "warning",
          subject_ref: "tests/default/inline-history.md",
        }),
      ]),
    );
  });

  it("should mark metadata-only expectations as not requested", async () => {
    const outputDir = join(tempDir, "metadata-only-expectations");
    const matching = createTestResult({
      id: "tr-metadata-only",
      historyId: "metadata-only-history",
      name: "metadata-only test",
      fullName: "metadata-only test",
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([matching]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    await new AgentPlugin({
      outputDir,
      expectations: {
        goal: "record review context",
        task_id: "TASK-1",
      },
    }).done(createContext(), store);

    const runManifest = await readJson<{
      expectation_result: {
        status: string;
        impact: string;
        recognized_control_count: number;
        summary: {
          observed_tests: number;
        };
      };
    }>(join(outputDir, "manifest", "run.json"));

    expect(runManifest.expectation_result).toEqual(
      expect.objectContaining({
        status: "not_requested",
        impact: "advisory",
        recognized_control_count: 2,
      }),
    );
    expect(runManifest.expectation_result.summary.observed_tests).toBe(1);
  });

  it("should render every parsed inline expectation config field", async () => {
    const traceAttachment = createAttachment({
      id: "trace-json",
      name: "trace.json",
      originalFileName: "trace.json",
      ext: ".json",
      contentType: "application/json",
    });
    const { outputDir, findings } = await runInlineExpectationCase({
      outputName: "parsed-inline-config-fields",
      environmentId: "web",
      testResult: createTestResult({
        id: "tr-parsed-config",
        historyId: "parsed-config-history",
        fullName: "suite expected behavior",
        labels: [
          {
            name: "feature",
            value: "scope",
          },
        ],
        steps: [createMeaningfulStep()],
      }),
      attachments: [traceAttachment],
      attachmentContents: {
        "trace-json": {
          content: "{}",
          fileName: "trace.json",
        },
      },
      expectations: {
        goal: "Review parsed inline config fields",
        task_id: "agent-inline-fields",
        expected: {
          test_count: 1,
          environments: ["web"],
          full_names: ["suite expected behavior"],
          full_name_prefixes: ["suite expected"],
          label_values: {
            feature: "scope",
          },
        },
        forbidden: {
          environments: ["api"],
          full_names: ["suite forbidden behavior"],
          full_name_prefixes: ["suite forbidden"],
          label_values: {
            feature: ["forbidden"],
          },
        },
        evidence: {
          min_steps: 1,
          min_attachments: 1,
          step_name_contains: ["assert expected behavior"],
          attachments: [
            {
              name: "trace.json",
            },
            {
              content_type: "application/json",
            },
          ],
        },
        notes: "Keep every field visible to reviewers",
      },
    });

    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(findings).toEqual([]);
    expect(indexContent).toContain("Goal: Review parsed inline config fields");
    expect(indexContent).toContain("Feature / Task: agent-inline-fields");
    expect(indexContent).toContain(
      "Expected selectors: test count: 1 | environments: web | full names: suite expected behavior | prefixes: suite expected | labels: feature in [scope]",
    );
    expect(indexContent).toContain(
      "Forbidden selectors: environments: api | full names: suite forbidden behavior | prefixes: suite forbidden | labels: feature in [forbidden]",
    );
    expect(indexContent).toContain(
      "Evidence expectations: meaningful steps per test: >= 1 | attachments per test: >= 1 | step contains: assert expected behavior | attachments: name=trace.json; content-type=application/json",
    );
    expect(indexContent).toContain("Notes: Keep every field visible to reviewers");
  });

  it.each([
    {
      field: "expected.test_count",
      expectations: {
        expected: {
          test_count: 1,
        },
      },
    },
    {
      field: "expected.environments",
      environmentId: "web",
      expectations: {
        expected: {
          environments: ["web"],
        },
      },
    },
    {
      field: "expected.full_names",
      expectations: {
        expected: {
          full_names: ["suite expected behavior"],
        },
      },
    },
    {
      field: "expected.full_name_prefixes",
      expectations: {
        expected: {
          full_name_prefixes: ["suite expected"],
        },
      },
    },
    {
      field: "expected.label_values",
      testResult: createTestResult({
        id: "tr-expected-label-pass",
        historyId: "expected-label-pass-history",
        fullName: "suite expected behavior",
        labels: [
          {
            name: "feature",
            value: "scope",
          },
        ],
      }),
      expectations: {
        expected: {
          label_values: {
            feature: "scope",
          },
        },
      },
    },
  ])("should report no findings when $field is met", async ({ field, expectations, testResult, environmentId }) => {
    const { findings } = await runInlineExpectationCase({
      outputName: expectationOutputName(field, "met"),
      expectations,
      testResult,
      environmentId,
    });

    expect(findings).toEqual([]);
  });

  it.each([
    {
      field: "expected.test_count",
      checkName: "expected-count-mismatch",
      expectations: {
        expected: {
          test_count: 2,
        },
      },
    },
    {
      field: "expected.environments",
      checkName: "expected-environment-missing",
      environmentId: "api",
      expectations: {
        expected: {
          environments: ["web"],
        },
      },
    },
    {
      field: "expected.full_names",
      checkName: "expected-test-missing",
      expectations: {
        expected: {
          full_names: ["suite missing behavior"],
        },
      },
    },
    {
      field: "expected.full_name_prefixes",
      checkName: "expected-prefix-missing",
      expectations: {
        expected: {
          full_name_prefixes: ["suite missing"],
        },
      },
    },
    {
      field: "expected.label_values",
      checkName: "expected-label-missing",
      testResult: createTestResult({
        id: "tr-expected-label-fail",
        historyId: "expected-label-fail-history",
        fullName: "suite expected behavior",
        labels: [
          {
            name: "feature",
            value: "other",
          },
        ],
      }),
      expectations: {
        expected: {
          label_values: {
            feature: "scope",
          },
        },
      },
    },
  ])(
    "should report $checkName when $field is not met",
    async ({ field, checkName, expectations, testResult, environmentId }) => {
      const { findings } = await runInlineExpectationCase({
        outputName: expectationOutputName(field, "missing"),
        expectations,
        testResult,
        environmentId,
      });

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            check_name: checkName,
          }),
        ]),
      );
    },
  );

  it.each([
    {
      field: "forbidden.environments",
      environmentId: "web",
      expectations: {
        forbidden: {
          environments: ["api"],
        },
      },
    },
    {
      field: "forbidden.full_names",
      expectations: {
        forbidden: {
          full_names: ["suite forbidden behavior"],
        },
      },
    },
    {
      field: "forbidden.full_name_prefixes",
      expectations: {
        forbidden: {
          full_name_prefixes: ["suite forbidden"],
        },
      },
    },
    {
      field: "forbidden.label_values",
      testResult: createTestResult({
        id: "tr-forbidden-label-pass",
        historyId: "forbidden-label-pass-history",
        fullName: "suite expected behavior",
        labels: [
          {
            name: "feature",
            value: "scope",
          },
        ],
      }),
      expectations: {
        forbidden: {
          label_values: {
            feature: "forbidden",
          },
        },
      },
    },
  ])(
    "should report no findings when $field is not matched",
    async ({ field, expectations, testResult, environmentId }) => {
      const { findings } = await runInlineExpectationCase({
        outputName: expectationOutputName(field, "allowed"),
        expectations,
        testResult,
        environmentId,
      });

      expect(findings).toEqual([]);
    },
  );

  it.each([
    {
      field: "forbidden.environments",
      checkName: "forbidden-selector-match",
      environmentId: "api",
      expectations: {
        forbidden: {
          environments: ["api"],
        },
      },
    },
    {
      field: "forbidden.full_names",
      checkName: "forbidden-selector-match",
      expectations: {
        forbidden: {
          full_names: ["suite expected behavior"],
        },
      },
    },
    {
      field: "forbidden.full_name_prefixes",
      checkName: "forbidden-selector-match",
      expectations: {
        forbidden: {
          full_name_prefixes: ["suite expected"],
        },
      },
    },
    {
      field: "forbidden.label_values",
      checkName: "forbidden-label-observed",
      testResult: createTestResult({
        id: "tr-forbidden-label-fail",
        historyId: "forbidden-label-fail-history",
        fullName: "suite expected behavior",
        labels: [
          {
            name: "feature",
            value: "forbidden",
          },
        ],
      }),
      expectations: {
        forbidden: {
          label_values: {
            feature: "forbidden",
          },
        },
      },
    },
  ])(
    "should report $checkName when $field is matched",
    async ({ field, checkName, expectations, testResult, environmentId }) => {
      const { findings } = await runInlineExpectationCase({
        outputName: expectationOutputName(field, "forbidden"),
        expectations,
        testResult,
        environmentId,
      });

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            check_name: checkName,
          }),
        ]),
      );
    },
  );

  it.each([
    {
      field: "evidence.step_name_contains",
      expectations: {
        evidence: {
          step_name_contains: ["expected behavior"],
        },
      },
      testResult: createTestResult({
        id: "tr-evidence-step-text-pass",
        historyId: "evidence-step-text-pass-history",
        fullName: "suite expected behavior",
        steps: [createMeaningfulStep()],
      }),
    },
    {
      field: "evidence.min_steps",
      expectations: {
        evidence: {
          min_steps: 1,
        },
      },
      testResult: createTestResult({
        id: "tr-evidence-steps-pass",
        historyId: "evidence-steps-pass-history",
        fullName: "suite expected behavior",
        steps: [createMeaningfulStep()],
      }),
    },
    {
      field: "evidence.min_attachments",
      expectations: {
        evidence: {
          min_attachments: 1,
        },
      },
      attachments: [
        createAttachment({
          id: "evidence-attachment-pass",
          name: "evidence.txt",
          originalFileName: "evidence.txt",
        }),
      ],
      attachmentContents: {
        "evidence-attachment-pass": {
          content: "evidence",
          fileName: "evidence.txt",
        },
      },
    },
    {
      field: "evidence.attachments.name",
      expectations: {
        evidence: {
          attachments: [
            {
              name: "evidence.txt",
            },
          ],
        },
      },
      attachments: [
        createAttachment({
          id: "evidence-name-pass",
          name: "evidence.txt",
          originalFileName: "evidence.txt",
        }),
      ],
      attachmentContents: {
        "evidence-name-pass": {
          content: "evidence",
          fileName: "evidence.txt",
        },
      },
    },
    {
      field: "evidence.attachments.content_type",
      expectations: {
        evidence: {
          attachments: [
            {
              content_type: "application/json",
            },
          ],
        },
      },
      attachments: [
        createAttachment({
          id: "evidence-type-pass",
          name: "evidence.json",
          originalFileName: "evidence.json",
          ext: ".json",
          contentType: "application/json",
        }),
      ],
      attachmentContents: {
        "evidence-type-pass": {
          content: "{}",
          fileName: "evidence.json",
        },
      },
    },
  ])(
    "should report no findings when $field is met",
    async ({ field, expectations, testResult, attachments, attachmentContents }) => {
      const { findings } = await runInlineExpectationCase({
        outputName: expectationOutputName(field, "met"),
        expectations,
        testResult,
        attachments,
        attachmentContents,
      });

      expect(findings).toEqual([]);
    },
  );

  it("should match expected step text in nested test-scoped steps", async () => {
    const nestedStep = {
      ...createMeaningfulStep("parent action"),
      steps: [createMeaningfulStep("Validate order total includes discount")],
    } as TestStepResult;
    const { findings } = await runInlineExpectationCase({
      outputName: "evidence-step-name-nested-met",
      expectations: {
        evidence: {
          step_name_contains: ["order total includes discount"],
        },
      },
      testResult: createTestResult({
        id: "tr-nested-step",
        historyId: "nested-step-history",
        fullName: "suite expected behavior",
        steps: [nestedStep],
      }),
    });

    expect(findings).toEqual([]);
  });

  it("should not satisfy expected step text from global output only", async () => {
    const { findings } = await runInlineExpectationCase({
      outputName: "evidence-step-name-global-output-missing",
      expectations: {
        evidence: {
          step_name_contains: ["global-only marker"],
        },
      },
      attachmentContents: {
        "global-stdout": {
          content: "global-only marker",
          fileName: "stdout.txt",
        },
      },
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "expected-step-containing-missing",
        }),
      ]),
    );
  });

  it.each([
    {
      field: "evidence.step_name_contains",
      checkName: "expected-step-containing-missing",
      expectations: {
        evidence: {
          step_name_contains: ["expected behavior"],
        },
      },
    },
    {
      field: "evidence.min_steps",
      checkName: "insufficient-expected-steps",
      expectations: {
        evidence: {
          min_steps: 1,
        },
      },
    },
    {
      field: "evidence.min_attachments",
      checkName: "insufficient-expected-attachments",
      expectations: {
        evidence: {
          min_attachments: 1,
        },
      },
    },
    {
      field: "evidence.attachments.name",
      checkName: "missing-expected-attachment",
      expectations: {
        evidence: {
          attachments: [
            {
              name: "evidence.txt",
            },
          ],
        },
      },
    },
    {
      field: "evidence.attachments.content_type",
      checkName: "missing-expected-attachment",
      expectations: {
        evidence: {
          attachments: [
            {
              content_type: "application/json",
            },
          ],
        },
      },
    },
  ])("should report $checkName when $field is not met", async ({ field, checkName, expectations }) => {
    const { findings } = await runInlineExpectationCase({
      outputName: expectationOutputName(field, "missing"),
      expectations,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: checkName,
        }),
      ]),
    );
  });

  it("should emit bootstrap findings when no visible tests are present", async () => {
    const outputDir = join(tempDir, "bootstrap");
    const store = createStore({
      testsStatistic: vi.fn().mockResolvedValue({ total: 0 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const findingsManifest = await readJsonl<{
      check_name: string;
      severity: "info" | "warning" | "high";
    }>(join(outputDir, "manifest", "findings.jsonl"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "no-tests-observed",
          severity: "high",
        }),
        expect.objectContaining({
          check_name: "missing-global-logs",
          severity: "info",
        }),
      ]),
    );
    expect(indexContent).toContain("No visible test results were found in the run.");
  });

  it("should accept zero observed logical tests when --expect-tests 0 was requested", async () => {
    const outputDir = join(tempDir, "expect-zero-tests");
    const store = createStore({
      testsStatistic: vi.fn().mockResolvedValue({ total: 0 }),
    });

    await new AgentPlugin({
      outputDir,
      expectations: {
        goal: "Verify no logical tests are selected",
        expected: {
          test_count: 0,
        },
      },
    }).done(createContext(), store);

    const runManifest = await readJson<{
      expectation_result: {
        status: string;
        impact: string;
      };
    }>(join(outputDir, "manifest", "run.json"));
    const findingsManifest = await readJsonl<{
      check_name: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));

    expect(runManifest.expectation_result).toEqual(expect.objectContaining({ status: "matched", impact: "accept" }));
    expect(findingsManifest).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "no-tests-observed",
        }),
      ]),
    );
  });

  it("should surface partial runtime modeling and high-signal stderr summaries", async () => {
    const outputDir = join(tempDir, "partial-runtime");
    const stderrAttachment = createAttachment({
      id: "stderr-partial",
      name: "stderr.txt",
      originalFileName: "stderr.txt",
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([
        createTestResult({
          id: "tr-partial",
          historyId: "partial-history",
          fullName: "suite partial runtime",
          duration: 45,
        }),
      ]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 2, passed: 1, skipped: 1 }),
      allGlobalAttachments: vi.fn().mockResolvedValue([stderrAttachment]),
      attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "stderr-partial") {
          return new BufferResultFile(
            Buffer.from(
              [
                "Unhandled Error",
                "Error: Failed to load url yaml (resolved id: yaml)",
                "Error: Cannot find package 'yaml' imported from /tmp/example.test.ts",
                "NO_COLOR is ignored",
                "NO_COLOR is ignored",
              ].join("\n"),
              "utf-8",
            ),
            "stderr.txt",
          );
        }

        return undefined;
      }),
      allGlobalErrors: vi.fn().mockResolvedValue([
        {
          message: "Unhandled error while loading the suite",
        },
      ]),
      globalExitCode: vi.fn().mockResolvedValue({ original: 1, actual: 1 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const runManifest = await readJson<{
      actual_exit_code: number | null;
      original_exit_code: number | null;
      summary: {
        compact: {
          completeness: "complete" | "partial";
          visible_results: number;
          logical_tests: number;
          unmodeled_visible_results: number;
          runner_failures_outside_logical_tests: number;
          findings: number;
        };
        unmodeled_from_stats: {
          skipped: number;
        };
      };
      modeling: {
        completeness: "complete" | "partial";
        reasons: string[];
        runnerFailures: {
          total: number;
          globalErrors: number;
          stderrActionable: number;
        };
        stderr: {
          actionableCount: number;
          noisyWarningCount: number;
          actionableSamples: string[];
          noisyWarningSamples: string[];
        };
      };
    }>(join(outputDir, "manifest", "run.json"));
    const findingsManifest = await readJsonl<{
      check_name: string;
      severity: "info" | "warning" | "high";
    }>(join(outputDir, "manifest", "findings.jsonl"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(runManifest.actual_exit_code).toBe(1);
    expect(runManifest.original_exit_code).toBe(1);
    expect(runManifest.summary.compact.completeness).toBe("partial");
    expect(runManifest.summary.compact.visible_results).toBe(2);
    expect(runManifest.summary.compact.logical_tests).toBe(1);
    expect(runManifest.summary.compact.unmodeled_visible_results).toBe(1);
    expect(runManifest.summary.compact.runner_failures_outside_logical_tests).toBeGreaterThan(0);
    expect(runManifest.summary.compact.findings).toBeGreaterThan(0);
    expect(runManifest.summary.unmodeled_from_stats.skipped).toBe(1);
    expect(runManifest.modeling.completeness).toBe("partial");
    expect(runManifest.modeling.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Visible results were not fully rendered as logical tests"),
        expect.stringContaining("runner-level failures were detected outside logical test files"),
      ]),
    );
    expect(runManifest.modeling.runnerFailures.globalErrors).toBe(1);
    expect(runManifest.modeling.runnerFailures.stderrActionable).toBeGreaterThan(0);
    expect(runManifest.modeling.stderr.actionableCount).toBeGreaterThan(0);
    expect(runManifest.modeling.stderr.noisyWarningCount).toBe(2);
    expect(runManifest.modeling.stderr.actionableSamples).toEqual(
      expect.arrayContaining([expect.stringContaining("Failed to load url yaml")]),
    );
    expect(runManifest.modeling.stderr.noisyWarningSamples).toContain("NO_COLOR is ignored");
    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "runner-failures-outside-logical-results",
          severity: "high",
        }),
        expect.objectContaining({
          check_name: "unmodeled-visible-results",
          severity: "info",
        }),
      ]),
    );
    expect(indexContent).toContain("## Runtime Modeling Summary");
    expect(indexContent).toContain("- completeness: partial");
    expect(indexContent).toContain("### High-Signal Runner Issues");
    expect(indexContent).toContain("Failed to load url yaml");
    expect(indexContent).toContain("### Repeated Low-Value Warnings");
    expect(indexContent).toContain("NO\\_COLOR is ignored");
  });

  it("should prefer actionable missing-tool stderr over setup frame noise", async () => {
    const outputDir = join(tempDir, "missing-tool-runtime");
    const stderrAttachment = createAttachment({
      id: "stderr-missing-tool",
      name: "stderr.txt",
      originalFileName: "stderr.txt",
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 0 }),
      allGlobalAttachments: vi.fn().mockResolvedValue([stderrAttachment]),
      attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "stderr-missing-tool") {
          return new BufferResultFile(
            Buffer.from(
              [
                "1606| beforeAll(async () => {",
                'xcrun: error: unable to find utility "xcresulttool", not a developer tool or in PATH',
                "NO_COLOR is ignored",
              ].join("\n"),
              "utf-8",
            ),
            "stderr.txt",
          );
        }

        return undefined;
      }),
      allGlobalErrors: vi.fn().mockResolvedValue([]),
      globalExitCode: vi.fn().mockResolvedValue({ original: 1, actual: 1 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const runManifest = await readJson<{
      modeling: {
        stderr: {
          actionableSamples: string[];
        };
        runnerFailures: {
          samples: Array<{
            message: string;
          }>;
        };
      };
    }>(join(outputDir, "manifest", "run.json"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(runManifest.modeling.stderr.actionableSamples).toEqual(
      expect.arrayContaining([expect.stringContaining('unable to find utility "xcresulttool"')]),
    );
    expect(runManifest.modeling.runnerFailures.samples).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("xcresulttool") })]),
    );
    expect(runManifest.modeling.stderr.actionableSamples).not.toEqual(
      expect.arrayContaining([expect.stringContaining("beforeAll(async () => {")]),
    );
    expect(indexContent).toContain('unable to find utility "xcresulttool"');
  });

  it("should keep findings empty for a clean expected run", async () => {
    const outputDir = join(tempDir, "clean-expected-run");
    const expectationsPath = join(tempDir, "clean-expected.json");
    const stdoutAttachment = createAttachment({
      id: "stdout-clean",
      name: "stdout.txt",
      originalFileName: "stdout.txt",
    });
    const testResult = createTestResult({
      id: "tr-clean",
      historyId: "clean-history",
      fullName: "feature clean run",
      duration: 40,
      labels: [
        {
          name: "feature",
          value: "clean",
        },
      ],
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
      environmentIdByTrId: vi.fn().mockResolvedValue("default"),
      allGlobalAttachments: vi.fn().mockResolvedValue([stdoutAttachment]),
      attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "stdout-clean") {
          return new BufferResultFile(Buffer.from("clean stdout", "utf-8"), "stdout.txt");
        }

        return undefined;
      }),
    });

    await writeFile(
      expectationsPath,
      JSON.stringify({
        goal: "Validate a clean run",
        task_id: "clean-run",
        expected: {
          environments: ["default"],
          full_names: ["feature clean run"],
          label_values: {
            feature: "clean",
          },
        },
      }),
      "utf-8",
    );

    await new AgentPlugin({ outputDir, expectationsPath, command: "yarn test clean-run" }).done(createContext(), store);

    const runManifest = await readJson<{
      actual_exit_code: number | null;
      original_exit_code: number | null;
      summary: {
        compact: {
          completeness: "complete" | "partial";
          visible_results: number;
          logical_tests: number;
          unmodeled_visible_results: number;
        };
      };
      modeling: {
        completeness: "complete" | "partial";
      };
      check_summary: {
        total: number;
      };
    }>(join(outputDir, "manifest", "run.json"));
    const findingsManifest = await readJsonl(join(outputDir, "manifest", "findings.jsonl"));
    const indexContent = await readText(join(outputDir, "index.md"), "text/markdown");

    expect(runManifest.check_summary.total).toBe(0);
    expect(runManifest.actual_exit_code).toBeNull();
    expect(runManifest.original_exit_code).toBeNull();
    expect(runManifest.summary.compact).toEqual(
      expect.objectContaining({
        completeness: "complete",
        visible_results: 1,
        logical_tests: 1,
        unmodeled_visible_results: 0,
      }),
    );
    expect(runManifest.modeling.completeness).toBe("complete");
    expect(findingsManifest).toEqual([]);
    expect(indexContent).toContain("## Expected Scope");
    expect(indexContent).toContain("## Runtime Modeling Summary");
    expect(indexContent).toContain("- completeness: complete");
    expect(indexContent).toContain("- total findings: 0");
    expect(indexContent).toContain("## Needs Attention First");
    expect(indexContent).toContain("None");
  });

});
