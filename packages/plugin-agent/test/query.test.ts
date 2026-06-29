import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentUsageError } from "../src/errors.js";
import type { AgentOutputBundle } from "../src/harness.js";
import {
  AGENT_TEST_STATUSES,
  buildAgentQueryPayload,
  normalizeAgentQueryLimit,
  normalizeRepeatedEnumValues,
} from "../src/query.js";
import { attachJsonEvidence } from "./evidence.js";

let tempDir: string | undefined;

const createAgentOutput = (outputDir: string): AgentOutputBundle => ({
  outputDir,
  run: {
    schema_version: "allure-agent-output/v1",
    report_uuid: "report-uuid",
    generated_at: "2026-06-02T12:00:00.000Z",
    phase: "done",
    command: "npm test",
    actual_exit_code: 1,
    original_exit_code: 1,
    exit_code: {
      original: 1,
      actual: null,
    },
    summary: {
      stats: {
        total: 2,
        failed: 1,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 1,
      },
      duration_ms: {
        total: 30,
        average: 15,
        max: 20,
      },
      environments: [
        {
          environmentId: "default",
          total: 2,
          failed: 1,
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
      test_events_manifest: "manifest/test-events.jsonl",
      expected_manifest: "manifest/expected.json",
      process_logs: {
        stdout: "artifacts/global/stdout.txt",
        stderr: "artifacts/global/stderr.txt",
      },
    },
    expectations_present: true,
    expectations: {
      goal: "Check query",
    },
    expectation_result: {
      schema_version: "allure-agent-expectation-result/v1",
      status: "failed",
      impact: "reject",
      source: {
        kind: "inline",
        path: null,
      },
      recognized_control_count: 2,
      unsupported_controls: [],
      degraded_controls: [],
      summary: {
        expected_tests: 0,
        observed_tests: 2,
        missing_expected: 1,
        forbidden_observed: 0,
        unexpected_observed: 0,
        evidence_mismatches: 0,
      },
      finding_ids: ["finding-1"],
    },
    check_summary: {
      total: 2,
      countsBySeverity: {
        high: 1,
        warning: 1,
        info: 0,
      },
      countsByCategory: {
        bootstrap: 0,
        scope: 1,
        metadata: 0,
        evidence: 1,
        smells: 0,
      },
    },
    agent_context: {
      agent_name: null,
      loop_id: null,
      task_id: "agent-query",
      conversation_id: null,
    },
  },
  tests: [
    {
      environment_id: "default",
      history_id: "history-1",
      test_result_id: "tr-1",
      full_name: "suite should fail",
      package: "pkg-a",
      labels: [{ name: "module", value: "cli" }],
      status: "failed",
      duration_ms: 20,
      retries: 0,
      flaky: false,
      scope_match: "match",
      finding_counts: {
        total: 1,
        high: 1,
        warning: 0,
        info: 0,
      },
      markdown_path: "tests/default/suite-should-fail.md",
      assets_dir: "artifacts/tests/default/suite-should-fail",
    },
    {
      environment_id: "default",
      history_id: "history-2",
      test_result_id: "tr-2",
      full_name: "suite should pass",
      package: "pkg-b",
      labels: [{ name: "module", value: "ui" }],
      status: "passed",
      duration_ms: 10,
      retries: 0,
      flaky: false,
      scope_match: "match",
      finding_counts: {
        total: 0,
        high: 0,
        warning: 0,
        info: 0,
      },
      markdown_path: "tests/default/suite-should-pass.md",
      assets_dir: "artifacts/tests/default/suite-should-pass",
    },
  ],
  findings: [
    {
      schema_version: "allure-agent-finding/v2",
      check_id: "expected-label-missing",
      instance_id: "finding-1",
      finding_id: "finding-1",
      subject: {
        type: "test",
        id: "tests/default/suite-should-fail.md",
        path: "tests/default/suite-should-fail.md",
      },
      subject_ref: "tests/default/suite-should-fail.md",
      subject_type: "test",
      severity: "high",
      impact: "reject",
      category: "scope",
      check_name: "expected-label-missing",
      message: "Expected label module=api was not found.",
      explanation: "The observed labels did not satisfy the expectation.",
      evidence_paths: ["tests/default/suite-should-fail.md"],
      remediation_hint: "Run the intended test or update metadata.",
    },
    {
      finding_id: "finding-2",
      subject: "run",
      severity: "warning",
      category: "evidence",
      check_name: "missing-evidence",
      message: "Evidence is weak.",
      explanation: "The run did not contain meaningful evidence.",
      evidence_paths: ["index.md"],
      remediation_hint: "Add steps or attachments.",
    },
  ],
  expected: {
    goal: "Check query",
  },
});

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent-query");
  await label("coverage", "agent-mode");
  tempDir = await mkdtemp(join(tmpdir(), "allure-agent-query-test-"));
  await mkdir(join(tempDir, "tests/default"), { recursive: true });
  await writeFile(join(tempDir, "tests/default/suite-should-fail.md"), "# Test Markdown\n\nRuntime evidence.", {
    encoding: "utf-8",
    flag: "w",
  });
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("agent query payloads", () => {
  it("should build a summary payload", async () => {
    const payload = await buildAgentQueryPayload(createAgentOutput(tempDir!), "summary", {
      labelFilters: [],
    });

    await attachJsonEvidence("summary query payload", payload);
    expect(payload).toEqual(
      expect.objectContaining({
        schema: "allure-agent-query/v1",
        view: "summary",
        output_dir: tempDir,
        index_md: join(tempDir!, "index.md"),
        run: expect.objectContaining({
          command: "npm test",
          expectations_present: true,
          expectation_result: expect.objectContaining({ status: "failed", impact: "reject" }),
        }),
        paths: expect.objectContaining({
          tests_manifest: join(tempDir!, "manifest/tests.jsonl"),
        }),
        expected: {
          goal: "Check query",
        },
      }),
    );
  });

  it("should build filtered test payloads", async () => {
    const payload = await buildAgentQueryPayload(createAgentOutput(tempDir!), "tests", {
      labelFilters: [{ name: "module", value: "cli" }],
      statuses: ["failed"],
      limit: 1,
    });

    await attachJsonEvidence("filtered tests query payload", payload);
    expect(payload).toEqual(
      expect.objectContaining({
        view: "tests",
        total_matches: 1,
        returned: 1,
        tests: [expect.objectContaining({ full_name: "suite should fail", status: "failed" })],
      }),
    );
  });

  it("should build filtered finding payloads", async () => {
    const payload = await buildAgentQueryPayload(createAgentOutput(tempDir!), "findings", {
      labelFilters: [],
      severities: ["high"],
      categories: ["scope"],
      checks: ["expected-label-missing"],
      test: "suite should fail",
    });

    await attachJsonEvidence("filtered findings query payload", payload);
    expect(payload).toEqual(
      expect.objectContaining({
        view: "findings",
        total_matches: 1,
        findings: [expect.objectContaining({ finding_id: "finding-1" })],
      }),
    );
  });

  it("should build one-test payloads with markdown when requested", async () => {
    const payload = await buildAgentQueryPayload(createAgentOutput(tempDir!), "test", {
      labelFilters: [],
      test: "suite should fail",
      includeMarkdown: true,
    });

    await attachJsonEvidence("single test query payload", payload);
    expect(payload).toEqual(
      expect.objectContaining({
        view: "test",
        markdown_path: join(tempDir!, "tests/default/suite-should-fail.md"),
        test: expect.objectContaining({ full_name: "suite should fail" }),
        findings: [expect.objectContaining({ finding_id: "finding-1" })],
        markdown: expect.stringContaining("Runtime evidence."),
      }),
    );
  });

  it("does not read a per-test markdown_path that escapes the output directory", async () => {
    const outsideName = `allure-agent-query-outside-${process.pid}.md`;
    const outsidePath = join(tmpdir(), outsideName);
    await writeFile(outsidePath, "OUTSIDE SECRET", "utf-8");

    try {
      const output = createAgentOutput(tempDir!);
      const tampered: AgentOutputBundle = {
        ...output,
        findings: [],
        tests: [{ ...output.tests[0], full_name: "evil test", markdown_path: `../${outsideName}` }],
      };

      const payload = await buildAgentQueryPayload(tampered, "test", {
        labelFilters: [],
        test: "evil test",
        includeMarkdown: true,
      });

      expect(payload).toEqual(expect.objectContaining({ view: "test", markdown_path: null }));
      expect(payload).not.toHaveProperty("markdown");
    } finally {
      await rm(outsidePath, { force: true });
    }
  });

  it("should reject ambiguous single-test queries and unsupported enum values", async () => {
    await attachJsonEvidence("invalid query option cases", [
      { view: "test", reason: "missing exact test selector" },
      { option: "--status", value: "flaky", reason: "unsupported status" },
      { option: "--limit", value: "1.5", reason: "limit must be an integer" },
    ]);

    await expect(
      buildAgentQueryPayload(createAgentOutput(tempDir!), "test", {
        labelFilters: [],
      }),
    ).rejects.toBeInstanceOf(AgentUsageError);

    expect(() => normalizeRepeatedEnumValues(["flaky"], AGENT_TEST_STATUSES, "--status")).toThrow(AgentUsageError);
    expect(() => normalizeAgentQueryLimit("1.5")).toThrow(AgentUsageError);
  });
});
