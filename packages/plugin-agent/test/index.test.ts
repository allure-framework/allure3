import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AttachmentLink, TestError, TestFixtureResult, TestResult, TestStepResult } from "@allurereport/core-api";
import type {
  AllureStore,
  ExitCode,
  PluginContext,
  QualityGateValidationResult,
  RealtimeSubscriber,
  ResultFile,
} from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentPlugin } from "../src/plugin.js";

const AGENT_ENV_VARS = [
  "ALLURE_AGENT_OUTPUT",
  "ALLURE_AGENT_EXPECTATIONS",
  "ALLURE_AGENT_COMMAND",
  "ALLURE_AGENT_PROJECT_ROOT",
  "ALLURE_AGENT_NAME",
  "ALLURE_AGENT_LOOP_ID",
  "ALLURE_AGENT_TASK_ID",
  "ALLURE_AGENT_CONVERSATION_ID",
] as const;

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
    hidden: false,
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
    testResults: [] as Array<(trIds: string[]) => Promise<void>>,
    globalAttachments: [] as Array<(payload: { attachment: ResultFile; fileName?: string }) => Promise<void>>,
    globalErrors: [] as Array<(error: TestError) => Promise<void>>,
    globalExitCodes: [] as Array<(payload: ExitCode) => Promise<void>>,
    qualityGateResults: [] as Array<(payload: QualityGateValidationResult[]) => Promise<void>>,
  };

  const subscriber: RealtimeSubscriber = {
    onTestResults: vi.fn((listener: (trIds: string[]) => Promise<void>) => {
      listeners.testResults.push(listener);

      return () => {
        listeners.testResults = listeners.testResults.filter((candidate) => candidate !== listener);
      };
    }),
    onGlobalAttachment: vi.fn((listener: (payload: { attachment: ResultFile; fileName?: string }) => Promise<void>) => {
      listeners.globalAttachments.push(listener);

      return () => {
        listeners.globalAttachments = listeners.globalAttachments.filter((candidate) => candidate !== listener);
      };
    }),
    onGlobalError: vi.fn((listener: (error: TestError) => Promise<void>) => {
      listeners.globalErrors.push(listener);

      return () => {
        listeners.globalErrors = listeners.globalErrors.filter((candidate) => candidate !== listener);
      };
    }),
    onGlobalExitCode: vi.fn((listener: (payload: ExitCode) => Promise<void>) => {
      listeners.globalExitCodes.push(listener);

      return () => {
        listeners.globalExitCodes = listeners.globalExitCodes.filter((candidate) => candidate !== listener);
      };
    }),
    onQualityGateResults: vi.fn((listener: (payload: QualityGateValidationResult[]) => Promise<void>) => {
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
        await listener(trIds);
      }
    },
  };
};

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf-8")) as T;

const readJsonl = async <T>(path: string): Promise<T[]> =>
  (await readFile(path, "utf-8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

describe("AgentPlugin", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "plugin-agent-"));
    AGENT_ENV_VARS.forEach((name) => {
      delete process.env[name];
    });
  });

  afterEach(async () => {
    AGENT_ENV_VARS.forEach((name) => {
      delete process.env[name];
    });
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
    const guide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
    const testEvents = await readFile(join(outputDir, "manifest", "test-events.jsonl"), "utf-8");

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
    const testContent = await readFile(join(outputDir, "tests", "default", "live-history.md"), "utf-8");
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

  it("should prefer option outputDir over ALLURE_AGENT_OUTPUT", async () => {
    const optionDir = join(tempDir, "option-output");
    const envDir = join(tempDir, "env-output");
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([createTestResult()]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    process.env.ALLURE_AGENT_OUTPUT = envDir;

    await new AgentPlugin({ outputDir: optionDir }).done(createContext(), store);

    await expect(stat(join(optionDir, "index.md"))).resolves.toBeTruthy();
    await expect(stat(join(optionDir, "AGENTS.md"))).resolves.toBeTruthy();
    await expect(stat(join(envDir, "index.md"))).rejects.toThrow();
  });

  it("should clean only managed entries before writing", async () => {
    const outputDir = join(tempDir, "managed-cleanup");

    await mkdir(join(outputDir, "tests"), { recursive: true });
    await mkdir(join(outputDir, "artifacts"), { recursive: true });
    await writeFile(join(outputDir, "index.md"), "stale", "utf-8");
    await writeFile(join(outputDir, "AGENTS.md"), "stale", "utf-8");
    await writeFile(join(outputDir, "notes.txt"), "keep me", "utf-8");

    await new AgentPlugin({ outputDir }).done(createContext(), createStore());

    expect(await readFile(join(outputDir, "notes.txt"), "utf-8")).toBe("keep me");
    expect(await readFile(join(outputDir, "index.md"), "utf-8")).toContain("# Agent Report");
    expect(await readFile(join(outputDir, "AGENTS.md"), "utf-8")).toContain("# AGENTS Guide");
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

    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
    const testContent = await readFile(join(outputDir, "tests", "default", "history.id_1.md"), "utf-8");

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
      hidden: true,
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

    const primaryContent = await readFile(join(outputDir, "tests", "default", "shared-history.md"), "utf-8");

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

    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");

    expect(indexContent).toContain("# My Report");
    expect(indexContent).toContain("## Process Logs");
    expect(indexContent).not.toContain("## Global Artifacts");
    expect(indexContent).toContain("[stdout.txt](artifacts/global/stdout.txt)");
    expect(indexContent).toContain("[stderr.txt](artifacts/global/stderr.txt)");
    expect(indexContent).toContain("stdout.txt");
    expect(indexContent).toContain("stderr.txt");
    expect(indexContent).toContain("Too many failures");
    expect(await readFile(join(outputDir, "artifacts", "global", "stdout.txt"), "utf-8")).toBe("stdout content");
    expect(await readFile(join(outputDir, "artifacts", "global", "stderr.txt"), "utf-8")).toBe("stderr content");
    expect(await readFile(join(outputDir, "AGENTS.md"), "utf-8")).toContain("## Reading Order");
  });

  it("should copy project guidance and reference it from AGENTS.md and run manifest", async () => {
    const outputDir = join(tempDir, "project-guide");
    const projectRoot = join(tempDir, "project-root");
    const guidePath = join(projectRoot, "docs", "allure-agent-mode.md");
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([createTestResult()]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
    });

    await mkdir(join(projectRoot, "docs"), { recursive: true });
    await writeFile(guidePath, "# Project Allure Guide\n\nUse agent mode here.\n", "utf-8");
    process.env.ALLURE_AGENT_PROJECT_ROOT = projectRoot;

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const guideCopy = await readFile(join(outputDir, "project", "docs", "allure-agent-mode.md"), "utf-8");
    const agentsGuide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");
    const runManifest = await readJson<{
      paths: {
        project_guide: string | null;
      };
    }>(join(outputDir, "manifest", "run.json"));

    expect(guideCopy).toContain("Project Allure Guide");
    expect(agentsGuide).toContain("[project guidance](project/docs/allure-agent-mode.md)");
    expect(runManifest.paths.project_guide).toBe("project/docs/allure-agent-mode.md");
  });

  it("should include downstream enrichment best practices in AGENTS.md", async () => {
    const outputDir = join(tempDir, "agents-guide");

    await new AgentPlugin({ outputDir }).done(createContext(), createStore());

    const guide = await readFile(join(outputDir, "AGENTS.md"), "utf-8");

    expect(guide).toContain("## Enrichment Loop Workflow");
    expect(guide).toContain("## Verification Standard");
    expect(guide).toContain("manifest/test-events.jsonl");
    expect(guide).toContain("allure agent latest");
    expect(guide).toContain("allure agent state-dir");
    expect(guide).toContain("allure agent select --latest");
    expect(guide).toContain("allure agent --rerun-latest");
    expect(guide).toContain("--rerun-preset");
    expect(guide).toContain("--rerun-environment");
    expect(guide).toContain("--rerun-label");
    expect(guide).toContain("ALLURE_AGENT_STATE_DIR");
    expect(guide).toContain("print the `index.md` path");
    expect(guide).toContain(
      "If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.",
    );
    expect(guide).toContain("Use `allure agent` for smoke checks too, even when the change is small or mechanical.");
    expect(guide).toContain("Only skip agent mode when it is impossible or when you are debugging agent mode itself.");
    expect(guide).toContain("## Small Test Change Workflow");
    expect(guide).toContain("## Coverage Review Workflow");
    expect(guide).toContain("## Test Enrichment Best Practices");
    expect(guide).toContain("## Anti-Dummy Policy");
    expect(guide).toContain("## Acceptance Checklist");
    expect(guide).toContain("## Review Completeness");
    expect(guide).toContain("## Partial Runtime Review");
    expect(guide).toContain("teach `runCommand` to emit a step");
    expect(guide).toContain("`failed-without-useful-steps`");
    expect(guide).toContain("`noop-dominated-steps`");
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

    const content = await readFile(join(outputDir, "tests", "default", "artifact-history.md"), "utf-8");

    expect(content).toContain("### Before Fixture: setup");
    expect(content).toContain("### Steps");
    expect(content).toContain("missing attachment");
    expect(content).toContain("screenshot.png");
    expect(content).toContain("fixture.log");
    expect(
      await readFile(join(outputDir, "tests", "default", "artifact-history.assets", "screenshot.png"), "utf-8"),
    ).toBe("png-bytes");
    expect(await readFile(join(outputDir, "tests", "default", "artifact-history.assets", "fixture.log"), "utf-8")).toBe(
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

    process.env.ALLURE_AGENT_EXPECTATIONS = expectationsPath;
    process.env.ALLURE_AGENT_COMMAND = "yarn test feature-a";
    process.env.ALLURE_AGENT_NAME = "codex";
    process.env.ALLURE_AGENT_LOOP_ID = "loop-1";
    process.env.ALLURE_AGENT_CONVERSATION_ID = "conversation-1";

    await new AgentPlugin({ outputDir }).done(createContext(), store);

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
        project_guide: string | null;
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
      subject: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");
    const forbiddenContent = await readFile(join(outputDir, "tests", "api", "feature-b-history.md"), "utf-8");

    expect(runManifest.command).toBe("yarn test feature-a");
    expect(runManifest.expectations_present).toBe(true);
    expect(runManifest.paths.expected_manifest).toBe("manifest/expected.json");
    expect(runManifest.paths.project_guide).toBeNull();
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
          check_name: "forbidden-selector-match",
          severity: "high",
          subject: "tests/api/feature-b-history.md",
        }),
        expect.objectContaining({
          check_name: "unexpected-environment",
          severity: "warning",
          subject: "run",
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
    expect(await readFile(join(outputDir, "manifest", "expected.json"), "utf-8")).toContain('"task_id": "feature-a"');
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
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");

    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "no-visible-tests",
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
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");

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
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");

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

    process.env.ALLURE_AGENT_EXPECTATIONS = expectationsPath;
    process.env.ALLURE_AGENT_COMMAND = "yarn test clean-run";

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
    const indexContent = await readFile(join(outputDir, "index.md"), "utf-8");

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

  it("should add evidence findings and rerun guidance when a failed test lacks signal", async () => {
    const outputDir = join(tempDir, "rerun-guidance");
    const testResult = createTestResult({
      id: "tr-low-signal",
      historyId: "low-signal-history",
      fullName: "suite low signal",
      status: "failed",
      duration: 250,
      error: {
        message: "boom",
      },
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1 }),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const testContent = await readFile(join(outputDir, "tests", "default", "low-signal-history.md"), "utf-8");
    const findingsManifest = await readJsonl<{
      check_name: string;
      subject: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));

    expect(testContent).toContain("failed-without-useful-steps");
    expect(testContent).toContain("failed-without-attachments");
    expect(testContent).toContain("nontrivial-run-with-empty-trace");
    expect(testContent).toContain("## Rerun Guidance");
    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "failed-without-useful-steps",
          subject: "tests/default/low-signal-history.md",
        }),
        expect.objectContaining({
          check_name: "failed-without-attachments",
          subject: "tests/default/low-signal-history.md",
        }),
      ]),
    );
  });

  it("should emit retry-evidence findings when retries do not add new signal", async () => {
    const outputDir = join(tempDir, "retry-evidence");
    const current = createTestResult({
      id: "tr-current",
      historyId: "retry-evidence-history",
      fullName: "suite retry evidence",
      status: "failed",
      duration: 150,
      start: 400,
      error: {
        message: "same failure",
        trace: "same trace",
      },
    });
    const retry = createTestResult({
      id: "tr-retry",
      historyId: "retry-evidence-history",
      fullName: "suite retry evidence",
      status: "failed",
      hidden: true,
      duration: 150,
      start: 300,
      error: {
        message: "same failure",
        trace: "same trace",
      },
    });
    const store = createStore({
      allTestResults: vi.fn().mockResolvedValue([current]),
      testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1, retries: 1 }),
      retriesByTr: vi.fn().mockResolvedValue([retry]),
    });

    await new AgentPlugin({ outputDir }).done(createContext(), store);

    const testContent = await readFile(join(outputDir, "tests", "default", "retry-evidence-history.md"), "utf-8");
    const findingsManifest = await readJsonl<{
      check_name: string;
      severity: "info" | "warning" | "high";
      subject: string;
    }>(join(outputDir, "manifest", "findings.jsonl"));

    expect(testContent).toContain("retries-without-new-evidence");
    expect(testContent).toContain("## Retry 1");
    expect(findingsManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: "retries-without-new-evidence",
          severity: "info",
          subject: "tests/default/retry-evidence-history.md",
        }),
      ]),
    );
  });
});
