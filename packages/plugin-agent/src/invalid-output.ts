import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { AgentExpectationUsageError } from "./errors.js";
import { isFileNotFoundError } from "./utils.js";

const emptyAgentStats = () => ({
  total: 0,
  failed: 0,
  broken: 0,
  skipped: 0,
  unknown: 0,
  passed: 0,
});

const writeJson = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const writeText = async (path: string, value: string) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf-8");
};

const writeJsonl = async (path: string, values: unknown[]) => {
  await writeText(path, values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : ""));
};

export const createInvalidExpectationFinding = (params: { message: string; sourceOption?: string }) => {
  const action = "Fix expectation syntax before using the run as validation.";

  return {
    schema_version: "allure-agent-finding/v2",
    check_id: "expectations-invalid",
    instance_id: "F0001",
    severity: "high",
    impact: "reject",
    confidence: 1,
    category: "bootstrap",
    title: "Expectation input is invalid",
    message: params.message,
    subject: {
      type: "run",
    },
    expected: params.sourceOption ? { option: params.sourceOption } : { expectations: "valid M1 expectation input" },
    observed: {
      error: params.message,
      execution_skipped: true,
    },
    evidence: {
      paths: ["manifest/run.json"],
    },
    action,
    source: params.sourceOption
      ? {
          kind: "inline-option",
          option: params.sourceOption,
        }
      : undefined,
    legacy: {
      finding_id: "F0001",
      check_name: "expectations-invalid",
      remediation_hint: action,
    },
    finding_id: "F0001",
    subject_ref: "run",
    subject_type: "run",
    check_name: "expectations-invalid",
    explanation: "The agent expectation controls could not be parsed, so the test command was not executed.",
    evidence_paths: ["manifest/run.json"],
    remediation_hint: action,
    expected_reference: params.sourceOption,
  };
};

export const writeInvalidAgentExpectationOutput = async (params: {
  outputDir: string;
  command: string;
  error: AgentExpectationUsageError;
}) => {
  const { outputDir, command, error } = params;
  const generatedAt = new Date().toISOString();
  const finding = createInvalidExpectationFinding({
    message: error.message,
    sourceOption: error.sourceOption,
  });
  const stats = emptyAgentStats();

  try {
    await rm(outputDir, { recursive: true });
  } catch (rmError) {
    if (!isFileNotFoundError(rmError)) {
      console.error("could not clean output directory", rmError);
    }
  }

  const runManifest = {
    schema_version: "allure-agent-output/v1",
    report_uuid: null,
    generated_at: generatedAt,
    phase: "done",
    command,
    actual_exit_code: null,
    original_exit_code: null,
    exit_code: null,
    summary: {
      stats,
      modeled_stats: stats,
      unmodeled_from_stats: stats,
      compact: {
        visible_results: 0,
        logical_tests: 0,
        unmodeled_visible_results: 0,
        runner_failures_outside_logical_tests: 0,
        completeness: "complete",
        findings: 1,
      },
      duration_ms: {
        total: 0,
        average: 0,
        max: 0,
      },
      environments: [],
    },
    modeling: {
      completeness: "complete",
      reasons: ["test command was skipped because agent expectations were invalid"],
      modeledStats: stats,
      unmodeledFromStats: stats,
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
        visible_results: 0,
        logical_tests: 0,
        unmodeled_visible_results: 0,
        runner_failures_outside_logical_tests: 0,
        completeness: "complete",
      },
    },
    paths: {
      index_md: "index.md",
      agents_md: "AGENTS.md",
      tests_manifest: "manifest/tests.jsonl",
      findings_manifest: "manifest/findings.jsonl",
      test_events_manifest: "manifest/test-events.jsonl",
      expected_manifest: null,
      process_logs: {
        stdout: null,
        stderr: null,
      },
    },
    expectations_present: false,
    expectations: null,
    expectation_result: {
      schema_version: "allure-agent-expectation-result/v1",
      status: "unavailable",
      impact: "reject",
      source: {
        kind: "none",
        path: null,
      },
      recognized_control_count: 0,
      unsupported_controls: [],
      degraded_controls: [],
      summary: {
        expected_tests: 0,
        observed_tests: 0,
        missing_expected: 0,
        forbidden_observed: 0,
        unexpected_observed: 0,
        evidence_mismatches: 0,
      },
      finding_ids: ["F0001"],
    },
    check_summary: {
      total: 1,
      countsBySeverity: {
        high: 1,
        warning: 0,
        info: 0,
      },
      countsByCategory: {
        bootstrap: 1,
        scope: 0,
        metadata: 0,
        evidence: 0,
        smells: 0,
      },
    },
    agent_context: {
      agent_name: null,
      loop_id: null,
      task_id: null,
      conversation_id: null,
    },
  };
  const index = [
    "# Allure Agent Run",
    "",
    "- Phase: done",
    `- Command: ${command || "(not executed)"}`,
    "- Exit code: not available",
    "",
    "## Expectation Result",
    "",
    "- Status: unavailable",
    "- Impact: reject",
    "- Recognized controls: 0",
    "- Summary: expectation input was invalid; test execution was skipped",
    "",
    "## Findings",
    "",
    `- [HIGH][reject][bootstrap] ${finding.title}`,
    `  Expected: ${error.sourceOption ?? "valid M1 expectation input"}`,
    `  Observed: ${error.message}`,
    `  Action: ${finding.action}`,
    "",
    "## Machine-Readable Artifacts",
    "",
    "- Run Manifest: [manifest/run.json](manifest/run.json)",
    "- Findings Manifest: [manifest/findings.jsonl](manifest/findings.jsonl)",
    "",
  ].join("\n");

  await Promise.all([
    writeJson(join(outputDir, "manifest", "run.json"), runManifest),
    writeJsonl(join(outputDir, "manifest", "findings.jsonl"), [finding]),
    writeJsonl(join(outputDir, "manifest", "tests.jsonl"), []),
    writeJsonl(join(outputDir, "manifest", "test-events.jsonl"), []),
    writeText(join(outputDir, "index.md"), index),
    writeText(
      join(outputDir, "AGENTS.md"),
      [
        "# Allure Agent Output",
        "",
        "Read `index.md`, `manifest/run.json`, and `manifest/findings.jsonl` before using this run.",
        "",
      ].join("\n"),
    ),
  ]);

  return {
    outputDir,
    generatedAt,
  };
};
