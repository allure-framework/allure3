import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { AgentRunManifest } from "../src/harness.js";
import type { AgentHumanReportStatus } from "../src/model.js";
import { formatAgentRunSummary } from "../src/summary.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent-summary");
  await label("coverage", "agent-mode");
});

const outputDir = "/abs/agent-output";

const createRun = (overrides: Partial<AgentRunManifest> = {}): AgentRunManifest =>
  ({
    actual_exit_code: 1,
    original_exit_code: 1,
    summary: {
      stats: { total: 9, passed: 8, failed: 1 },
    },
    paths: {
      index_md: "index.md",
      agents_md: "AGENTS.md",
      tests_manifest: "manifest/tests.jsonl",
      findings_manifest: "manifest/findings.jsonl",
      process_logs: {
        stdout: "artifacts/global/stdout.txt",
        stderr: "artifacts/global/stderr.txt",
      },
    },
    expectations_present: false,
    expectation_result: { status: "matched", impact: "accept" },
    check_summary: { total: 0, countsBySeverity: { high: 0, warning: 0, info: 0 }, countsByCategory: {} },
    ...overrides,
  }) as unknown as AgentRunManifest;

describe("agent run summary", () => {
  it("is compact and links the key artifacts with absolute paths", () => {
    const lines = formatAgentRunSummary({ outputDir, run: createRun() });
    const text = lines.join("\n");

    expect(lines.length).toBeLessThanOrEqual(20);
    expect(text).toContain("1 failed, 8 passed (9 total)");
    expect(text).toContain("exit 1");
    expect(text).toContain(join(outputDir, "index.md"));
    expect(text).toContain(join(outputDir, "manifest/findings.jsonl"));
    expect(text).toContain(join(outputDir, "manifest/tests.jsonl"));
    expect(text).toContain(join(outputDir, "artifacts/global/stdout.txt"));
    expect(text).toContain(join(outputDir, "artifacts/global/stderr.txt"));
    expect(text).toContain(join(outputDir, "manifest", "run.json"));
    expect(text).toContain(join(outputDir, "AGENTS.md"));
    expect(text).toContain(`allure agent query --from ${outputDir}`);
  });

  it("surfaces findings, flaky count, and expectation status when present", () => {
    const lines = formatAgentRunSummary({
      outputDir,
      run: createRun({
        summary: { stats: { total: 9, passed: 6, failed: 1, flaky: 2 } } as AgentRunManifest["summary"],
        expectations_present: true,
        expectation_result: { status: "failed", impact: "reject" } as AgentRunManifest["expectation_result"],
        check_summary: {
          total: 3,
          countsBySeverity: { high: 2, warning: 1, info: 0 },
          countsByCategory: {} as AgentRunManifest["check_summary"]["countsByCategory"],
        },
      }),
    });
    const text = lines.join("\n");

    expect(lines.length).toBeLessThanOrEqual(20);
    expect(text).toContain("2 flaky");
    expect(text).toContain("findings: 3 (2 high, 1 warning)");
    expect(text).toContain("expectations: failed (reject)");
  });

  it("links the human report as an absolute markdown link only when generated", () => {
    const generated = formatAgentRunSummary({
      outputDir,
      run: createRun(),
      humanReport: { status: "generated", path: "awesome/index.html" } as AgentHumanReportStatus,
    }).join("\n");

    expect(generated).toContain(`Here is the report: [report](${join(outputDir, "awesome/index.html")})`);
    // Must resolve to an absolute path, never link the relative manifest value directly.
    expect(generated).not.toContain("[report](awesome/index.html)");

    const skipped = formatAgentRunSummary({
      outputDir,
      run: createRun(),
      humanReport: { status: "skipped", path: null } as AgentHumanReportStatus,
    }).join("\n");

    expect(skipped).not.toContain("Here is the report");
  });

  it("omits optional sections for a clean pass with no findings or expectations", () => {
    const lines = formatAgentRunSummary({
      outputDir,
      run: createRun({ actual_exit_code: 0, original_exit_code: 0, summary: { stats: { total: 3, passed: 3 } } as AgentRunManifest["summary"] }),
    });
    const text = lines.join("\n");

    expect(text).toContain("3 passed (3 total)");
    expect(text).toContain("exit 0");
    expect(text).not.toContain("findings:");
    expect(text).not.toContain("expectations:");
  });

  it("includes global run time and a rerun-failed instruction when there are failures", () => {
    const lines = formatAgentRunSummary({
      outputDir,
      run: createRun(),
      durationMs: 75_000,
      rerunCommand: "npm test",
    });
    const text = lines.join("\n");

    expect(lines.length).toBeLessThanOrEqual(20);
    expect(text).toContain("1m 15s");
    expect(text).toContain("rerun failed: allure agent --rerun-latest --rerun-preset failed -- npm test");
    expect(text).toContain("(reruns 1 failed test)");
  });

  it("counts failed and broken tests together for the rerun-failed instruction", () => {
    const text = formatAgentRunSummary({
      outputDir,
      run: createRun({
        summary: { stats: { total: 9, passed: 6, failed: 2, broken: 1 } } as AgentRunManifest["summary"],
      }),
      rerunCommand: "npm test",
    }).join("\n");

    expect(text).toContain("(reruns 3 failed tests)");
  });

  it("omits the rerun-failed instruction on a clean pass or when no command is available", () => {
    const cleanPass = formatAgentRunSummary({
      outputDir,
      run: createRun({
        actual_exit_code: 0,
        original_exit_code: 0,
        summary: { stats: { total: 3, passed: 3 } } as AgentRunManifest["summary"],
      }),
      rerunCommand: "npm test",
    }).join("\n");

    expect(cleanPass).not.toContain("rerun failed");

    // Failures but no command to rerun (e.g. inspect mode) -> no rerun instruction.
    const noCommand = formatAgentRunSummary({ outputDir, run: createRun() }).join("\n");

    expect(noCommand).not.toContain("rerun failed");
  });
});
