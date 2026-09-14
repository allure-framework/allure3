import { join } from "node:path";

import type { Statistic } from "@allurereport/core-api";

import type { AgentRunManifest } from "./harness.js";
import type { AgentHumanReportStatus } from "./model.js";

const formatStatusCounts = (stats: Statistic): string => {
  const parts = [
    stats.failed ? `${stats.failed} failed` : undefined,
    stats.broken ? `${stats.broken} broken` : undefined,
    stats.passed ? `${stats.passed} passed` : undefined,
    stats.skipped ? `${stats.skipped} skipped` : undefined,
    stats.unknown ? `${stats.unknown} unknown` : undefined,
  ].filter((part): part is string => part !== undefined);
  const total = stats.total ?? 0;

  return `${parts.length ? parts.join(", ") : "no tests"} (${total} total)`;
};

const formatDurationMs = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = ms / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
};

const formatFindingCounts = (countsBySeverity: AgentRunManifest["check_summary"]["countsBySeverity"]): string =>
  [
    countsBySeverity.high ? `${countsBySeverity.high} high` : undefined,
    countsBySeverity.warning ? `${countsBySeverity.warning} warning` : undefined,
    countsBySeverity.info ? `${countsBySeverity.info} info` : undefined,
  ]
    .filter((part): part is string => part !== undefined)
    .join(", ");

/**
 * Build a compact (<=20 line) agent-facing summary of an agent run: status at a glance, the key
 * output links, and what to read where. An agent run does not echo the test command's own console
 * output, so this summary is the entry point to the captured evidence.
 */
export const formatAgentRunSummary = (params: {
  outputDir: string;
  run: AgentRunManifest;
  humanReport?: AgentHumanReportStatus | null;
  /** Wall-clock duration of the run, used for the "global run time" in the header. */
  durationMs?: number;
  /** The original test command; when set and the run has failures, a rerun-failed instruction is shown. */
  rerunCommand?: string;
}): string[] => {
  const { outputDir, run } = params;
  const humanReport = params.humanReport ?? run.human_report ?? undefined;
  const toAbsolute = (relativePath?: string | null) => (relativePath ? join(outputDir, relativePath) : undefined);
  const lines: string[] = [];

  const exitCode = run.actual_exit_code ?? run.original_exit_code;
  const flaky = run.summary.stats.flaky ?? 0;
  const failedCount = (run.summary.stats.failed ?? 0) + (run.summary.stats.broken ?? 0);

  lines.push(
    `Allure agent: ${formatStatusCounts(run.summary.stats)} · exit ${exitCode ?? "unknown"}` +
      (params.durationMs !== undefined ? ` · ${formatDurationMs(params.durationMs)}` : "") +
      (flaky ? ` · ${flaky} flaky` : ""),
  );

  if (run.check_summary.total > 0) {
    lines.push(
      `  findings: ${run.check_summary.total} (${formatFindingCounts(run.check_summary.countsBySeverity)}) — a green count is not a pass`,
    );
  }

  if (run.expectations_present) {
    lines.push(`  expectations: ${run.expectation_result.status} (${run.expectation_result.impact})`);
  }

  if (run.modeling?.completeness === "partial") {
    lines.push("  runtime modeling: partial — some runner failures are outside logical tests; check stderr");
  }

  if (params.rerunCommand && failedCount > 0) {
    // Use --rerun-from <this run's dir>, not --rerun-latest: under concurrent agent runs "latest" is
    // cwd-global and may resolve to a sibling run, while --from targets exactly this output.
    lines.push(
      `  rerun failed: allure agent --rerun-from ${outputDir} --rerun-preset failed -- ${params.rerunCommand}` +
        `  (reruns ${failedCount} failed test${failedCount === 1 ? "" : "s"})`,
    );
  }

  lines.push("");
  lines.push("Reach every conclusion from this agent output, not the raw console:");
  lines.push(`  overview   ${toAbsolute(run.paths.index_md)}  (read this first)`);
  lines.push(`  findings   ${toAbsolute(run.paths.findings_manifest)}`);
  lines.push(`  tests      ${toAbsolute(run.paths.tests_manifest)}`);

  const logs = [toAbsolute(run.paths.process_logs.stdout), toAbsolute(run.paths.process_logs.stderr)].filter(
    (value): value is string => value !== undefined,
  );

  if (logs.length) {
    lines.push(`  test logs  ${logs.join("  ")}`);
  }

  lines.push(`  run data   ${join(outputDir, "manifest", "run.json")}`);
  lines.push(`  guide      ${toAbsolute(run.paths.agents_md)}`);
  lines.push(`  inspect    allure agent query --from ${outputDir} summary|tests|findings|test`);

  const reportPath = humanReport?.status === "generated" ? toAbsolute(humanReport.path) : undefined;

  if (reportPath) {
    lines.push(`Here is the report: [report](${reportPath})`);
  }

  return lines;
};
