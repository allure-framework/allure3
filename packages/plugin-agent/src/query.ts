import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { TestLabel, TestStatus } from "@allurereport/core-api";

import { AgentUsageError } from "./errors.js";
import type { AgentFindingCategory, AgentFindingSeverity, AgentOutputBundle, AgentTestManifestLine } from "./harness.js";
import type { AgentLabelFilter } from "./selection.js";

export const AGENT_QUERY_SCHEMA = "allure-agent-query/v1";
export const AGENT_QUERY_VIEWS = ["summary", "tests", "findings", "test"] as const;
export const AGENT_TEST_STATUSES: TestStatus[] = ["failed", "broken", "unknown", "skipped", "passed"];
export const AGENT_FINDING_SEVERITIES: AgentFindingSeverity[] = ["high", "warning", "info"];
export const AGENT_FINDING_CATEGORIES: AgentFindingCategory[] = ["bootstrap", "scope", "metadata", "evidence", "smells"];

export type AgentQueryView = (typeof AGENT_QUERY_VIEWS)[number];

export type AgentQueryFilters = {
  environments?: string[];
  labelFilters: AgentLabelFilter[];
  statuses?: TestStatus[];
  severities?: AgentFindingSeverity[];
  categories?: AgentFindingCategory[];
  checks?: string[];
  test?: string;
  limit?: number;
  includeMarkdown?: boolean;
};

export const normalizeAgentQueryView = (value?: string): AgentQueryView => {
  if (!value) {
    return "summary";
  }

  const normalized = value.trim().toLowerCase();

  if (!AGENT_QUERY_VIEWS.includes(normalized as AgentQueryView)) {
    throw new AgentUsageError(
      `Invalid query view ${JSON.stringify(value)}. Expected one of: ${AGENT_QUERY_VIEWS.join(", ")}`,
    );
  }

  return normalized as AgentQueryView;
};

const normalizeOptionalStringValues = (values: string[] | undefined) =>
  values?.map((value) => value.trim()).filter(Boolean) ?? [];

export const normalizeRepeatedEnumValues = <T extends string>(
  values: string[] | undefined,
  allowed: readonly T[],
  optionName: string,
): T[] | undefined => {
  const normalized = normalizeOptionalStringValues(values).map((value) => value.toLowerCase());

  if (!normalized.length) {
    return undefined;
  }

  const invalid = normalized.find((value) => !allowed.includes(value as T));

  if (invalid) {
    throw new AgentUsageError(
      `Invalid ${optionName} value ${JSON.stringify(invalid)}. Expected one of: ${allowed.join(", ")}`,
    );
  }

  return normalized as T[];
};

export const normalizeRepeatedStringValues = (values: string[] | undefined): string[] | undefined => {
  const normalized = normalizeOptionalStringValues(values);

  return normalized.length ? normalized : undefined;
};

export const normalizeAgentQueryLimit = (value?: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new AgentUsageError("--limit must be a non-negative integer");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new AgentUsageError("--limit must be a non-negative integer");
  }

  return parsed;
};

const matchesLabelFilters = (labels: TestLabel[], filters: AgentLabelFilter[]) =>
  filters.every((filter) => labels.some((label) => label.name === filter.name && label.value === filter.value));

const matchesAgentTestIdentifier = (test: AgentTestManifestLine, identifier: string) =>
  test.full_name === identifier ||
  test.test_result_id === identifier ||
  test.history_id === identifier ||
  test.markdown_path === identifier;

const agentFindingSubjectRef = (finding: AgentOutputBundle["findings"][number]) => {
  if (finding.subject_ref) {
    return finding.subject_ref;
  }

  if (typeof finding.subject === "string") {
    return finding.subject;
  }

  return finding.subject.path ?? finding.subject.id ?? finding.subject.type;
};

const agentFindingCheckName = (finding: AgentOutputBundle["findings"][number]) =>
  finding.check_id ?? finding.check_name;

const filterAgentQueryTests = (tests: AgentTestManifestLine[], filters: AgentQueryFilters) =>
  tests
    .filter((test) => (filters.statuses?.length ? filters.statuses.includes(test.status) : true))
    .filter((test) => (filters.environments?.length ? filters.environments.includes(test.environment_id) : true))
    .filter((test) => (filters.labelFilters.length ? matchesLabelFilters(test.labels, filters.labelFilters) : true))
    .filter((test) => (filters.test ? matchesAgentTestIdentifier(test, filters.test) : true));

const hasAgentQueryTestFilters = (filters: AgentQueryFilters) =>
  Boolean(filters.statuses?.length || filters.environments?.length || filters.labelFilters.length || filters.test);

const filterAgentQueryFindings = (output: AgentOutputBundle, filters: AgentQueryFilters) => {
  const matchedSubjects = hasAgentQueryTestFilters(filters)
    ? new Set(filterAgentQueryTests(output.tests, filters).map((test) => test.markdown_path))
    : undefined;

  return output.findings
    .filter((finding) => (matchedSubjects ? matchedSubjects.has(agentFindingSubjectRef(finding)) : true))
    .filter((finding) => (filters.severities?.length ? filters.severities.includes(finding.severity) : true))
    .filter((finding) => (filters.categories?.length ? filters.categories.includes(finding.category) : true))
    .filter((finding) => (filters.checks?.length ? filters.checks.includes(agentFindingCheckName(finding)) : true));
};

const applyAgentQueryLimit = <T>(items: T[], limit: number | undefined): T[] =>
  limit === undefined ? items : items.slice(0, limit);

const resolveAgentOutputPath = (output: AgentOutputBundle, relativePath: string | null | undefined) =>
  relativePath ? join(output.outputDir, relativePath) : null;

const buildAgentQuerySummaryPayload = (output: AgentOutputBundle) => ({
  schema: AGENT_QUERY_SCHEMA,
  view: "summary",
  output_dir: output.outputDir,
  index_md: resolveAgentOutputPath(output, output.run.paths.index_md),
  run: {
    schema_version: output.run.schema_version,
    generated_at: output.run.generated_at,
    phase: output.run.phase ?? null,
    command: output.run.command,
    exit_code: output.run.exit_code,
    expectations_present: output.run.expectations_present,
    expectation_result: output.run.expectation_result,
    agent_context: output.run.agent_context,
  },
  summary: output.run.summary,
  modeling: output.run.modeling ?? null,
  check_summary: output.run.check_summary,
  paths: {
    index_md: resolveAgentOutputPath(output, output.run.paths.index_md),
    agents_md: resolveAgentOutputPath(output, output.run.paths.agents_md),
    tests_manifest: resolveAgentOutputPath(output, output.run.paths.tests_manifest),
    findings_manifest: resolveAgentOutputPath(output, output.run.paths.findings_manifest),
    test_events_manifest: resolveAgentOutputPath(output, output.run.paths.test_events_manifest),
    expected_manifest: resolveAgentOutputPath(output, output.run.paths.expected_manifest),
    process_logs: {
      stdout: resolveAgentOutputPath(output, output.run.paths.process_logs.stdout),
      stderr: resolveAgentOutputPath(output, output.run.paths.process_logs.stderr),
    },
  },
  ...(output.expected ? { expected: output.expected } : {}),
});

const buildAgentQueryTestsPayload = (output: AgentOutputBundle, filters: AgentQueryFilters) => {
  const matched = filterAgentQueryTests(output.tests, filters);
  const returned = applyAgentQueryLimit(matched, filters.limit);

  return {
    schema: AGENT_QUERY_SCHEMA,
    view: "tests",
    output_dir: output.outputDir,
    total_matches: matched.length,
    returned: returned.length,
    tests: returned,
  };
};

const buildAgentQueryFindingsPayload = (output: AgentOutputBundle, filters: AgentQueryFilters) => {
  const matched = filterAgentQueryFindings(output, filters);
  const returned = applyAgentQueryLimit(matched, filters.limit);

  return {
    schema: AGENT_QUERY_SCHEMA,
    view: "findings",
    output_dir: output.outputDir,
    total_matches: matched.length,
    returned: returned.length,
    findings: returned,
  };
};

const buildAgentQueryTestPayload = async (output: AgentOutputBundle, filters: AgentQueryFilters) => {
  const matched = filterAgentQueryTests(output.tests, filters);

  if (!matched.length) {
    throw new AgentUsageError(`No tests matched query in ${output.outputDir}`);
  }

  if (matched.length > 1) {
    throw new AgentUsageError(`Query matched ${matched.length} tests in ${output.outputDir}. Use --test <full-name-or-id>.`);
  }

  const test = matched[0];
  const markdownPath = resolveAgentOutputPath(output, test.markdown_path);
  const findings = output.findings.filter((finding) => agentFindingSubjectRef(finding) === test.markdown_path);

  return {
    schema: AGENT_QUERY_SCHEMA,
    view: "test",
    output_dir: output.outputDir,
    markdown_path: markdownPath,
    test,
    findings,
    ...(filters.includeMarkdown && markdownPath ? { markdown: await readFile(markdownPath, "utf-8") } : {}),
  };
};

export const buildAgentQueryPayload = async (
  output: AgentOutputBundle,
  view: AgentQueryView,
  filters: AgentQueryFilters,
) => {
  switch (view) {
    case "summary":
      return buildAgentQuerySummaryPayload(output);

    case "tests":
      return buildAgentQueryTestsPayload(output, filters);

    case "findings":
      return buildAgentQueryFindingsPayload(output, filters);

    case "test":
      return buildAgentQueryTestPayload(output, filters);
  }
};
