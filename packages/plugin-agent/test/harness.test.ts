import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { AttachmentLink, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentPlugin, {
  type AgentFindingManifestLine,
  type AgentOutputBundle,
  AGENT_ENRICHMENT_ACTIONS,
  buildAgentExpectations,
  mapFindingToEnrichmentAction,
  planAgentEnrichmentReview,
  reviewAgentOutput,
} from "../src/index.js";

const AGENT_ENV_VARS = ["ALLURE_AGENT_EXPECTATIONS", "ALLURE_AGENT_COMMAND", "ALLURE_AGENT_PROJECT_ROOT"] as const;

const createContext = (reportName: string = "Harness Report"): PluginContext =>
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

const createFinding = (overrides: Partial<AgentFindingManifestLine> = {}): AgentFindingManifestLine => ({
  finding_id: "finding-1",
  subject: "run",
  severity: "warning",
  category: "evidence",
  check_name: "failed-without-useful-steps",
  message: "Add meaningful steps.",
  explanation: "The trace is empty.",
  evidence_paths: ["tests/default/example.md"],
  remediation_hint: "Add meaningful steps.",
  ...overrides,
});

const createOutputBundle = (overrides: Partial<AgentOutputBundle> = {}): AgentOutputBundle => ({
  outputDir: "/tmp/agent-output",
  run: {
    schema_version: "allure-agent-output/v1",
    report_uuid: "report-uuid",
    generated_at: "2026-04-06T09:00:00.000Z",
    command: "yarn test",
    actual_exit_code: 0,
    original_exit_code: 0,
    exit_code: {
      original: 0,
      actual: 0,
    },
    summary: {
      stats: {
        total: 1,
        passed: 1,
      },
      modeled_stats: {
        total: 1,
        failed: 0,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 1,
      },
      unmodeled_from_stats: {
        total: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 0,
      },
      compact: {
        visible_results: 1,
        logical_tests: 1,
        unmodeled_visible_results: 0,
        runner_failures_outside_logical_tests: 0,
        completeness: "complete",
        findings: 0,
      },
      duration_ms: {
        total: 25,
        average: 25,
        max: 25,
      },
      environments: [
        {
          environmentId: "default",
          total: 1,
          failed: 0,
          broken: 0,
          skipped: 0,
          unknown: 0,
          passed: 1,
        },
      ],
    },
    paths: {
      index_md: "index.md",
      agents_md: "AGENTS.md",
      tests_manifest: "manifest/tests.jsonl",
      findings_manifest: "manifest/findings.jsonl",
      expected_manifest: "manifest/expected.json",
      project_guide: null,
      process_logs: {
        stdout: "artifacts/global/stdout.txt",
        stderr: null,
      },
    },
    modeling: {
      completeness: "complete",
      reasons: [],
      modeledStats: {
        total: 1,
        failed: 0,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 1,
      },
      unmodeledFromStats: {
        total: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 0,
      },
      runnerFailures: {
        total: 0,
        globalErrors: 0,
        stderrActionable: 0,
        samples: [],
      },
      stderr: {
        actionableCount: 0,
        actionableSamples: [],
        noisyWarningCount: 0,
        noisyWarningSamples: [],
      },
      compact: {
        visible_results: 1,
        logical_tests: 1,
        unmodeled_visible_results: 0,
        runner_failures_outside_logical_tests: 0,
        completeness: "complete",
      },
    },
    expectations_present: true,
    check_summary: {
      total: 0,
      countsBySeverity: {
        high: 0,
        warning: 0,
        info: 0,
      },
      countsByCategory: {
        bootstrap: 0,
        scope: 0,
        metadata: 0,
        evidence: 0,
        smells: 0,
      },
    },
    agent_context: {
      agent_name: "codex",
      loop_id: "loop-1",
      task_id: "task-1",
      conversation_id: "conversation-1",
    },
  },
  tests: [
    {
      environment_id: "default",
      history_id: "history-1",
      test_result_id: "tr-1",
      full_name: "suite should pass",
      package: "test.index.test.ts",
      labels: [],
      status: "passed",
      duration_ms: 25,
      retries: 0,
      flaky: false,
      scope_match: "match",
      scope_reasons: ["full name"],
      finding_counts: {
        total: 0,
        high: 0,
        warning: 0,
        info: 0,
      },
      markdown_path: "tests/default/history-1.md",
      assets_dir: "tests/default/history-1.assets",
    },
  ],
  findings: [],
  expected: {
    goal: "Verify suite should pass",
    task_id: "task-1",
    expected: {
      environments: ["default"],
      full_names: ["suite should pass"],
    },
  },
  ...overrides,
});

describe("agent enrichment harness", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "plugin-agent-harness-"));
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

  it("should build expectations from a harness request", () => {
    expect(
      buildAgentExpectations({
        goal: "Validate feature A",
        taskId: "feature-a",
        target: {
          environments: ["default", "default"],
          fullNames: ["suite feature A should work"],
          fullNamePrefixes: ["suite feature A"],
          labelValues: {
            feature: "feature-a",
            severity: ["critical", "critical"],
          },
        },
        forbidden: {
          fullNamePrefixes: ["suite feature B"],
        },
        notes: "Only feature A tests should run.",
        repoContext: {
          framework: "vitest",
          workspace: "/tmp/workspace",
        },
      }),
    ).toEqual({
      goal: "Validate feature A",
      task_id: "feature-a",
      expected: {
        environments: ["default"],
        full_names: ["suite feature A should work"],
        full_name_prefixes: ["suite feature A"],
        label_values: {
          feature: ["feature-a"],
          severity: ["critical"],
        },
      },
      forbidden: {
        full_name_prefixes: ["suite feature B"],
      },
      notes: ["Only feature A tests should run."],
    });
  });

  it("should map enrichment findings to the intended remediation categories", () => {
    expect(AGENT_ENRICHMENT_ACTIONS["failed-without-useful-steps"].category).toBe("add-meaningful-steps");
    expect(mapFindingToEnrichmentAction("nontrivial-run-with-empty-trace").category).toBe("add-meaningful-steps");
    expect(mapFindingToEnrichmentAction("passed-without-observable-evidence").category).toBe("add-meaningful-steps");
    expect(mapFindingToEnrichmentAction("failed-without-attachments").category).toBe("add-test-attachments");
    expect(mapFindingToEnrichmentAction("global-only-artifacts").category).toBe("add-test-attachments");
    expect(mapFindingToEnrichmentAction("runner-failures-outside-logical-results").category).toBe("bootstrap-allure");
    expect(mapFindingToEnrichmentAction("unmodeled-visible-results").category).toBe("review-manually");
    expect(mapFindingToEnrichmentAction("metadata-mismatch").category).toBe("repair-test-metadata");
    expect(mapFindingToEnrichmentAction("retries-without-new-evidence").category).toBe("add-retry-diagnostics");
    expect(mapFindingToEnrichmentAction("noop-dominated-steps").category).toBe("collapse-low-signal-trace");
    expect(mapFindingToEnrichmentAction("step-spam").category).toBe("collapse-low-signal-trace");
    expect(mapFindingToEnrichmentAction("unexpected-test").category).toBe("narrow-test-scope");
  });

  it("should reject high-confidence noop-style evidence", () => {
    const review = planAgentEnrichmentReview(
      createOutputBundle({
        findings: [
          createFinding({
            subject: "tests/default/history-1.md",
            check_name: "noop-dominated-steps",
            category: "smells",
            severity: "warning",
            confidence: 0.8,
            remediation_hint: "Remove empty wrapper steps.",
          }),
        ],
      }),
    );

    expect(review.status).toBe("reject");
    expect(review.rejecting).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "noop-dominated-steps",
          category: "collapse-low-signal-trace",
          acceptanceImpact: "reject",
        }),
      ]),
    );
    expect(review.notes).toContain(
      "Reject noop-dominated enrichment: keep only steps tied to real actions or checks, and use real runtime attachments instead of placeholders.",
    );
  });

  it("should accept a clean scoped run from a real agent output directory", async () => {
    const outputDir = join(tempDir, "clean-output");
    const expectationsPath = join(tempDir, "expected-clean.json");
    const stdoutAttachment = createAttachment({
      id: "stdout-clean",
      name: "stdout.txt",
      originalFileName: "stdout.txt",
    });
    const testResult = createTestResult({
      id: "tr-clean",
      historyId: "clean-history",
      fullName: "feature clean run",
      labels: [
        {
          name: "feature",
          value: "clean",
        },
      ],
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

    await new AgentPlugin({ outputDir }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        testsStatistic: vi.fn().mockResolvedValue({ total: 1, passed: 1 }),
        allGlobalAttachments: vi.fn().mockResolvedValue([stdoutAttachment]),
        attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
          if (id === "stdout-clean") {
            return new BufferResultFile(Buffer.from("clean stdout", "utf-8"), "stdout.txt");
          }

          return undefined;
        }),
      }),
    );

    const review = await reviewAgentOutput(outputDir);

    expect(review.status).toBe("accept");
    expect(review.plan).toEqual([]);
    expect(review.rerun.useExistingExpectations).toBe(true);
  });

  it("should reject scope drift from a real agent output directory", async () => {
    const outputDir = join(tempDir, "scope-drift-output");
    const expectationsPath = join(tempDir, "expected-scope.json");
    const matching = createTestResult({
      id: "tr-match",
      historyId: "feature-a-history",
      name: "feature A should work",
      fullName: "feature A should work",
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
      labels: [
        {
          name: "feature",
          value: "feature-b",
        },
      ],
    });

    await writeFile(
      expectationsPath,
      JSON.stringify({
        goal: "Verify feature A",
        task_id: "feature-a",
        expected: {
          environments: ["web"],
          full_name_prefixes: ["feature A"],
          label_values: {
            feature: "feature-a",
          },
        },
        forbidden: {
          full_names: ["feature B should not run"],
          label_values: {
            feature: "feature-b",
          },
        },
      }),
      "utf-8",
    );

    process.env.ALLURE_AGENT_EXPECTATIONS = expectationsPath;

    await new AgentPlugin({ outputDir }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue([matching, forbidden]),
        testsStatistic: vi.fn().mockResolvedValue({ total: 2, passed: 2 }),
        environmentIdByTrId: vi.fn().mockImplementation(async (id: string) => (id === "tr-match" ? "web" : "api")),
      }),
    );

    const review = await reviewAgentOutput(outputDir);

    expect(review.status).toBe("reject");
    expect(review.rejecting).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "forbidden-selector-match",
          category: "narrow-test-scope",
        }),
      ]),
    );
  });

  it("should iterate when a failed test needs real steps and attachments", async () => {
    const outputDir = join(tempDir, "low-signal-output");
    const expectationsPath = join(tempDir, "expected-low-signal.json");
    const testResult = createTestResult({
      id: "tr-low-signal",
      historyId: "low-signal-history",
      fullName: "suite low signal",
      status: "failed",
      duration: 250,
      labels: [
        {
          name: "feature",
          value: "feature-low-signal",
        },
      ],
      error: {
        message: "boom",
      },
    });

    await writeFile(
      expectationsPath,
      JSON.stringify({
        goal: "Improve low-signal failure evidence",
        task_id: "low-signal",
        expected: {
          environments: ["default"],
          full_names: ["suite low signal"],
          label_values: {
            feature: "feature-low-signal",
          },
        },
      }),
      "utf-8",
    );

    process.env.ALLURE_AGENT_EXPECTATIONS = expectationsPath;

    await new AgentPlugin({ outputDir }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1 }),
      }),
    );

    const review = await reviewAgentOutput(outputDir);

    expect(review.status).toBe("iterate");
    expect(review.iterate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "failed-without-useful-steps",
          category: "add-meaningful-steps",
        }),
        expect.objectContaining({
          checkName: "failed-without-attachments",
          category: "add-test-attachments",
        }),
      ]),
    );
    expect(review.rerun.targetedTests).toContain("suite low signal");
  });

  it("should iterate when runner failures exist outside logical test results", () => {
    const review = planAgentEnrichmentReview(
      createOutputBundle({
        findings: [
          createFinding({
            check_name: "runner-failures-outside-logical-results",
            category: "bootstrap",
            severity: "high",
            message: "Runner-level failures were detected outside logical test results.",
          }),
        ],
      }),
    );

    expect(review.status).toBe("iterate");
    expect(review.iterate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "runner-failures-outside-logical-results",
          category: "bootstrap-allure",
          acceptanceImpact: "iterate",
        }),
      ]),
    );
  });

  it("should iterate retry scenarios and request per-attempt diagnostics", async () => {
    const outputDir = join(tempDir, "retry-output");
    const expectationsPath = join(tempDir, "expected-retry.json");
    const current = createTestResult({
      id: "tr-current",
      historyId: "retry-evidence-history",
      fullName: "suite retry evidence",
      status: "failed",
      duration: 150,
      start: 400,
      labels: [
        {
          name: "feature",
          value: "retry-feature",
        },
      ],
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

    await writeFile(
      expectationsPath,
      JSON.stringify({
        goal: "Improve retry diagnostics",
        task_id: "retry-feature",
        expected: {
          environments: ["default"],
          full_names: ["suite retry evidence"],
          label_values: {
            feature: "retry-feature",
          },
        },
      }),
      "utf-8",
    );

    process.env.ALLURE_AGENT_EXPECTATIONS = expectationsPath;

    await new AgentPlugin({ outputDir }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue([current]),
        testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1, retries: 1 }),
        retriesByTr: vi.fn().mockResolvedValue([retry]),
      }),
    );

    const review = await reviewAgentOutput(outputDir);

    expect(review.status).toBe("iterate");
    expect(review.iterate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "retries-without-new-evidence",
          category: "add-retry-diagnostics",
        }),
      ]),
    );
  });
});
