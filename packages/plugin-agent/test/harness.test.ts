import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AttachmentLink, DefaultTestStepResult, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentPlugin, {
  type AgentFindingManifestLine,
  type AgentExpectationsInput,
  type AgentOutputBundle,
  AGENT_ENRICHMENT_ACTIONS,
  buildAgentExpectations,
  mapFindingToEnrichmentAction,
  planAgentEnrichmentReview,
  reviewAgentOutput,
} from "../src/index.js";
import { attachJsonEvidence } from "./evidence.js";

beforeEach(async () => {
  await story("harness");
});

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

const createStep = (overrides: Partial<DefaultTestStepResult> = {}): DefaultTestStepResult => ({
  name: "assert expected behavior",
  parameters: [],
  status: "passed",
  steps: [],
  type: "step",
  message: "checked",
  ...overrides,
});

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

const readJson = async <T>(path: string): Promise<T> => {
  const value = JSON.parse(await readFile(path, "utf-8")) as T;

  await attachJsonEvidence(`parsed ${path}`, value);

  return value;
};

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const content = await readFile(path, "utf-8");

  const values = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

  await attachJsonEvidence(`parsed ${path}`, values);

  return values;
};

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
    expectations: {
      goal: "Verify harness fixture",
    },
    expectation_result: {
      schema_version: "allure-agent-expectation-result/v1",
      status: "matched",
      impact: "accept",
      source: {
        kind: "inline",
        path: null,
      },
      recognized_control_count: 1,
      unsupported_controls: [],
      degraded_controls: [],
      summary: {
        expected_tests: 0,
        observed_tests: 1,
        missing_expected: 0,
        forbidden_observed: 0,
        unexpected_observed: 0,
        evidence_mismatches: 0,
      },
      finding_ids: [],
    },
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
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  type ExpectationHarnessRun = {
    expectations: AgentExpectationsInput;
    tests?: TestResult[];
    environmentByTestId?: Record<string, string>;
    attachmentsByTestId?: Record<string, AttachmentLink[]>;
    contentByAttachmentId?: Record<string, BufferResultFile>;
  };

  const runExpectationHarness = async (name: string, params: ExpectationHarnessRun) => {
    const outputDir = join(tempDir, name);
    const tests = params.tests ?? [createTestResult()];
    const stats = tests.reduce<Record<string, number>>(
      (acc, test) => {
        acc.total += 1;
        acc[test.status] = (acc[test.status] ?? 0) + 1;

        return acc;
      },
      {
        total: 0,
      },
    );

    await new AgentPlugin({
      outputDir,
      expectations: params.expectations,
      command: "yarn test expectation-harness",
    }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue(tests),
        testsStatistic: vi.fn().mockResolvedValue(stats),
        environmentIdByTrId: vi.fn().mockImplementation(async (id: string) => {
          return params.environmentByTestId?.[id] ?? "default";
        }),
        attachmentsByTrId: vi.fn().mockImplementation(async (id: string) => {
          return params.attachmentsByTestId?.[id] ?? [];
        }),
        attachmentContentById: vi.fn().mockImplementation(async (id: string) => {
          return params.contentByAttachmentId?.[id];
        }),
      }),
    );

    return {
      outputDir,
      run: await readJson<AgentOutputBundle["run"]>(join(outputDir, "manifest", "run.json")),
      findings: await readJsonl<AgentFindingManifestLine>(join(outputDir, "manifest", "findings.jsonl")),
    };
  };

  const expectNoExpectationFinding = (findings: AgentFindingManifestLine[], checkName: string) => {
    expect(findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: checkName,
        }),
      ]),
    );
  };

  const expectExpectationFinding = (findings: AgentFindingManifestLine[], checkName: string) => {
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_name: checkName,
        }),
      ]),
    );
  };

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

  it.each([
    {
      name: "expected test count",
      checkName: "expected-count-mismatch",
      matched: {
        expectations: {
          expected: {
            test_count: 1,
          },
        },
      },
      unmet: {
        expectations: {
          expected: {
            test_count: 2,
          },
        },
      },
    },
    {
      name: "expected test full name",
      checkName: "expected-test-missing",
      matched: {
        expectations: {
          expected: {
            full_names: ["suite should pass"],
          },
        },
      },
      unmet: {
        expectations: {
          expected: {
            full_names: ["suite should be visible"],
          },
        },
      },
    },
    {
      name: "expected test full-name prefix",
      checkName: "expected-prefix-missing",
      matched: {
        expectations: {
          expected: {
            full_name_prefixes: ["suite should"],
          },
        },
      },
      unmet: {
        expectations: {
          expected: {
            full_name_prefixes: ["api should"],
          },
        },
      },
    },
    {
      name: "expected environment",
      checkName: "expected-environment-missing",
      matched: {
        expectations: {
          expected: {
            environments: ["default"],
          },
        },
      },
      unmet: {
        expectations: {
          expected: {
            environments: ["web"],
          },
        },
      },
    },
    {
      name: "expected label value",
      checkName: "expected-label-missing",
      matched: {
        expectations: {
          expected: {
            label_values: {
              module: "cli",
            },
          },
        },
        tests: [
          createTestResult({
            labels: [{ name: "module", value: "cli" }],
          }),
        ],
      },
      unmet: {
        expectations: {
          expected: {
            label_values: {
              module: "cli",
            },
          },
        },
      },
    },
    {
      name: "forbidden label value",
      checkName: "forbidden-label-observed",
      matched: {
        expectations: {
          forbidden: {
            label_values: {
              layer: "e2e",
            },
          },
        },
      },
      unmet: {
        expectations: {
          forbidden: {
            label_values: {
              layer: "e2e",
            },
          },
        },
        tests: [
          createTestResult({
            labels: [{ name: "layer", value: "e2e" }],
          }),
        ],
      },
    },
    {
      name: "expected step text",
      checkName: "expected-step-containing-missing",
      matched: {
        expectations: {
          evidence: {
            step_name_contains: ["assert expected behavior"],
          },
        },
        tests: [
          createTestResult({
            steps: [createStep()],
          }),
        ],
      },
      unmet: {
        expectations: {
          evidence: {
            step_name_contains: ["assert expected behavior"],
          },
        },
      },
    },
    {
      name: "expected meaningful step count",
      checkName: "insufficient-expected-steps",
      matched: {
        expectations: {
          evidence: {
            min_steps: 1,
          },
        },
        tests: [
          createTestResult({
            steps: [createStep()],
          }),
        ],
      },
      unmet: {
        expectations: {
          evidence: {
            min_steps: 1,
          },
        },
      },
    },
    {
      name: "expected attachment count",
      checkName: "insufficient-expected-attachments",
      matched: {
        expectations: {
          evidence: {
            min_attachments: 1,
          },
        },
        attachmentsByTestId: {
          "tr-1": [createAttachment()],
        },
        contentByAttachmentId: {
          "attachment-1": new BufferResultFile(Buffer.from("artifact", "utf-8"), "artifact.txt"),
        },
      },
      unmet: {
        expectations: {
          evidence: {
            min_attachments: 1,
          },
        },
      },
    },
    {
      name: "expected attachment name",
      checkName: "missing-expected-attachment",
      matched: {
        expectations: {
          evidence: {
            attachments: [{ name: "artifact.txt" }],
          },
        },
        attachmentsByTestId: {
          "tr-1": [createAttachment()],
        },
        contentByAttachmentId: {
          "attachment-1": new BufferResultFile(Buffer.from("artifact", "utf-8"), "artifact.txt"),
        },
      },
      unmet: {
        expectations: {
          evidence: {
            attachments: [{ name: "missing.txt" }],
          },
        },
        attachmentsByTestId: {
          "tr-1": [createAttachment()],
        },
        contentByAttachmentId: {
          "attachment-1": new BufferResultFile(Buffer.from("artifact", "utf-8"), "artifact.txt"),
        },
      },
    },
    {
      name: "expected attachment content type",
      checkName: "missing-expected-attachment",
      matched: {
        expectations: {
          evidence: {
            attachments: [{ content_type: "text/plain" }],
          },
        },
        attachmentsByTestId: {
          "tr-1": [createAttachment()],
        },
        contentByAttachmentId: {
          "attachment-1": new BufferResultFile(Buffer.from("artifact", "utf-8"), "artifact.txt"),
        },
      },
      unmet: {
        expectations: {
          evidence: {
            attachments: [{ content_type: "application/json" }],
          },
        },
        attachmentsByTestId: {
          "tr-1": [createAttachment()],
        },
        contentByAttachmentId: {
          "attachment-1": new BufferResultFile(Buffer.from("artifact", "utf-8"), "artifact.txt"),
        },
      },
    },
  ] satisfies Array<{
    name: string;
    checkName: string;
    matched: ExpectationHarnessRun;
    unmet: ExpectationHarnessRun;
  }>)("should report $checkName only when $name is unmet", async ({ name, checkName, matched, unmet }) => {
    const matchedOutput = await runExpectationHarness(`${name.replace(/[^a-z0-9]+/gi, "-")}-matched`, matched);
    const unmetOutput = await runExpectationHarness(`${name.replace(/[^a-z0-9]+/gi, "-")}-unmet`, unmet);

    expectNoExpectationFinding(matchedOutput.findings, checkName);
    expectExpectationFinding(unmetOutput.findings, checkName);
  });

  it("should map enrichment findings to the intended remediation categories", async () => {
    const mappedActions = {
      "failed-without-useful-steps": AGENT_ENRICHMENT_ACTIONS["failed-without-useful-steps"].category,
      "nontrivial-run-with-empty-trace": mapFindingToEnrichmentAction("nontrivial-run-with-empty-trace").category,
      "passed-without-observable-evidence": mapFindingToEnrichmentAction("passed-without-observable-evidence").category,
      "failed-without-attachments": mapFindingToEnrichmentAction("failed-without-attachments").category,
      "global-only-artifacts": mapFindingToEnrichmentAction("global-only-artifacts").category,
      "runner-failures-outside-logical-results": mapFindingToEnrichmentAction("runner-failures-outside-logical-results")
        .category,
      "unmodeled-visible-results": mapFindingToEnrichmentAction("unmodeled-visible-results").category,
      "metadata-mismatch": mapFindingToEnrichmentAction("metadata-mismatch").category,
      "retries-without-new-evidence": mapFindingToEnrichmentAction("retries-without-new-evidence").category,
      "noop-dominated-steps": mapFindingToEnrichmentAction("noop-dominated-steps").category,
      "step-spam": mapFindingToEnrichmentAction("step-spam").category,
      "unexpected-test": mapFindingToEnrichmentAction("unexpected-test").category,
    };

    await attachJsonEvidence("enrichment action category map", mappedActions);
    expect(mappedActions).toEqual({
      "failed-without-useful-steps": "add-meaningful-steps",
      "nontrivial-run-with-empty-trace": "add-meaningful-steps",
      "passed-without-observable-evidence": "add-meaningful-steps",
      "failed-without-attachments": "add-test-attachments",
      "global-only-artifacts": "add-test-attachments",
      "runner-failures-outside-logical-results": "bootstrap-allure",
      "unmodeled-visible-results": "review-manually",
      "metadata-mismatch": "repair-test-metadata",
      "retries-without-new-evidence": "add-retry-diagnostics",
      "noop-dominated-steps": "collapse-low-signal-trace",
      "step-spam": "collapse-low-signal-trace",
      "unexpected-test": "narrow-test-scope",
    });
  });

  it("should reject high-confidence noop-style evidence", async () => {
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

    await attachJsonEvidence("noop-style evidence review decision", review);
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

    await new AgentPlugin({ outputDir, expectationsPath, command: "yarn test clean-run" }).done(
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

    await attachJsonEvidence("clean scoped run review decision", review);
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

    await new AgentPlugin({ outputDir, expectationsPath }).done(
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
          checkName: "forbidden-label-observed",
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

    await new AgentPlugin({ outputDir, expectationsPath }).done(
      createContext(),
      createStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        testsStatistic: vi.fn().mockResolvedValue({ total: 1, failed: 1 }),
      }),
    );

    const review = await reviewAgentOutput(outputDir);

    await attachJsonEvidence("low-signal failure review decision", review);
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
      isRetry: true,
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

    await new AgentPlugin({ outputDir, expectationsPath }).done(
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
