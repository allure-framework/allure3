import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Statistic, TestLabel, TestStatus } from "@allurereport/core-api";

import { ENRICHMENT_ACTIONS_BY_CHECK_NAME, type EnrichmentActionCategory } from "./guidance.js";

export type AgentFindingSeverity = "info" | "warning" | "high";
export type AgentFindingCategory = "bootstrap" | "scope" | "metadata" | "evidence" | "smells";
export type AgentScopeMatch = "match" | "unexpected" | "forbidden" | "unknown";
export type AgentAcceptanceStatus = "accept" | "iterate" | "reject";
export type AgentAcceptanceImpact = "advisory" | "iterate" | "reject";
export type AgentEnrichmentActionCategory = EnrichmentActionCategory;

export type AgentExpectationSelector = {
  environments?: string[];
  full_names?: string[];
  full_name_prefixes?: string[];
  label_values?: Record<string, string | string[]>;
};

export type AgentExpectations = {
  goal?: string;
  task_id?: string;
  expected?: AgentExpectationSelector;
  forbidden?: AgentExpectationSelector;
  notes?: string[];
};

export type AgentHarnessScopeInput = {
  environments?: string[];
  fullNames?: string[];
  fullNamePrefixes?: string[];
  labelValues?: Record<string, string | string[]>;
};

export type AgentHarnessRequest = {
  goal?: string;
  taskId?: string;
  target?: AgentHarnessScopeInput;
  expected?: AgentHarnessScopeInput;
  forbidden?: AgentHarnessScopeInput;
  notes?: string | string[];
  repoContext?: {
    framework?: string;
    workspace?: string;
  };
};

export type AgentRunManifest = {
  schema_version: string;
  report_uuid: string;
  generated_at: string;
  phase?: "running" | "done";
  command: string | null;
  actual_exit_code: number | null;
  original_exit_code: number | null;
  exit_code: {
    original: number;
    actual: number | null;
  } | null;
  summary: {
    stats: Statistic;
    modeled_stats?: {
      total: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      passed: number;
    };
    unmodeled_from_stats?: {
      total: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      passed: number;
    };
    compact?: {
      visible_results: number;
      logical_tests: number;
      unmodeled_visible_results: number;
      runner_failures_outside_logical_tests: number;
      completeness: "complete" | "partial";
      findings?: number;
    };
    duration_ms: {
      total: number;
      average: number;
      max: number;
    };
    environments: Array<{
      environmentId: string;
      total: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      passed: number;
    }>;
  };
  paths: {
    index_md: string;
    agents_md: string;
    tests_manifest: string;
    findings_manifest: string;
    test_events_manifest?: string;
    expected_manifest: string | null;
    project_guide: string | null;
    process_logs: {
      stdout: string | null;
      stderr: string | null;
    };
  };
  modeling?: {
    completeness: "complete" | "partial";
    reasons: string[];
    modeledStats: {
      total: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      passed: number;
    };
    unmodeledFromStats: {
      total: number;
      failed: number;
      broken: number;
      skipped: number;
      unknown: number;
      passed: number;
    };
    runnerFailures: {
      total: number;
      globalErrors: number;
      stderrActionable: number;
      samples: Array<{
        source: "stderr" | "global_error";
        kind: "import" | "suite-load" | "setup" | "global-error";
        message: string;
        count: number;
      }>;
    };
    stderr: {
      actionableCount: number;
      actionableSamples: string[];
      noisyWarningCount: number;
      noisyWarningSamples: string[];
    };
    compact: {
      visible_results: number;
      logical_tests: number;
      unmodeled_visible_results: number;
      runner_failures_outside_logical_tests: number;
      completeness: "complete" | "partial";
    };
  };
  expectations_present: boolean;
  check_summary: {
    total: number;
    countsBySeverity: Record<AgentFindingSeverity, number>;
    countsByCategory: Record<AgentFindingCategory, number>;
  };
  agent_context: {
    agent_name: string | null;
    loop_id: string | null;
    task_id: string | null;
    conversation_id: string | null;
  };
};

export type AgentTestManifestLine = {
  environment_id: string;
  history_id: string | null;
  test_result_id: string;
  full_name: string;
  package: string | null;
  labels: TestLabel[];
  status: TestStatus;
  duration_ms: number;
  retries: number;
  flaky: boolean;
  scope_match: AgentScopeMatch;
  scope_reasons?: string[];
  finding_counts: {
    total: number;
    high: number;
    warning: number;
    info: number;
  };
  markdown_path: string;
  assets_dir: string;
};

export type AgentFindingManifestLine = {
  finding_id: string;
  subject: string;
  severity: AgentFindingSeverity;
  category: AgentFindingCategory;
  check_name: string;
  message: string;
  explanation: string;
  evidence_paths: string[];
  remediation_hint: string;
  expected_reference?: string;
  confidence?: number;
};

export type AgentOutputBundle = {
  outputDir: string;
  run: AgentRunManifest;
  tests: AgentTestManifestLine[];
  findings: AgentFindingManifestLine[];
  expected?: AgentExpectations;
};

export type AgentEnrichmentAction = {
  checkName: string;
  category: AgentEnrichmentActionCategory;
  title: string;
  guidance: string;
};

export type AgentEnrichmentPlanItem = AgentEnrichmentAction & {
  subject: string;
  subjectType: "run" | "test";
  severity: AgentFindingSeverity;
  message: string;
  explanation: string;
  remediationHint: string;
  evidencePaths: string[];
  expectedReference?: string;
  confidence?: number;
  acceptanceImpact: AgentAcceptanceImpact;
  fullName?: string;
  markdownPath?: string;
  scopeMatch?: AgentScopeMatch;
};

export type AgentEnrichmentReview = {
  status: AgentAcceptanceStatus;
  outputDir: string;
  expectationsPresent: boolean;
  expected?: AgentExpectations;
  summary: {
    totalTests: number;
    totalFindings: number;
    planItems: number;
    rejectingItems: number;
    iterationItems: number;
    advisoryItems: number;
    countsByActionCategory: Record<AgentEnrichmentActionCategory, number>;
  };
  notes: string[];
  plan: AgentEnrichmentPlanItem[];
  rejecting: AgentEnrichmentPlanItem[];
  iterate: AgentEnrichmentPlanItem[];
  advisory: AgentEnrichmentPlanItem[];
  rerun: {
    requiresExpectations: boolean;
    useExistingExpectations: boolean;
    targetedTests: string[];
  };
};

export type AgentReviewOptions = {
  antiDummyConfidenceThreshold?: number;
  requireExpectationsForAcceptance?: boolean;
};

export const DEFAULT_ANTI_DUMMY_CONFIDENCE = 0.75;

const FALLBACK_ACTION: AgentEnrichmentAction = {
  checkName: "*",
  category: "review-manually",
  title: "Review the finding directly",
  guidance: "Inspect the linked markdown and follow the remediation hint before rerunning.",
};

export const AGENT_ENRICHMENT_ACTIONS: Record<string, AgentEnrichmentAction> = Object.fromEntries(
  Object.entries(ENRICHMENT_ACTIONS_BY_CHECK_NAME).map(([checkName, action]) => [checkName, { checkName, ...action }]),
) as Record<string, AgentEnrichmentAction>;

export const SCOPE_REJECTING_CHECKS = [
  "missing-expected-test",
  "missing-expected-prefix",
  "missing-expected-environment",
  "unexpected-environment",
  "forbidden-selector-match",
  "unexpected-test",
] as const;

export const ITERATION_REQUIRED_CHECKS = [
  "invalid-expectations-file",
  "no-visible-tests",
  "runner-failures-outside-logical-results",
  "missing-expected-label-selector",
  "metadata-mismatch",
  "history-id-collision",
  "failed-without-useful-steps",
  "failed-without-attachments",
  "nontrivial-run-with-empty-trace",
  "retries-without-new-evidence",
  "passed-without-observable-evidence",
] as const;

export const ANTI_DUMMY_CHECKS = ["noop-dominated-steps"] as const;

const SEVERITY_ORDER: Record<AgentFindingSeverity, number> = {
  high: 0,
  warning: 1,
  info: 2,
};

const IMPACT_ORDER: Record<AgentAcceptanceImpact, number> = {
  reject: 0,
  iterate: 1,
  advisory: 2,
};

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const normalizeStringArray = (value?: string | string[]) => {
  if (typeof value === "string") {
    return value.length ? [value] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueValues(value.filter((item): item is string => typeof item === "string" && item.length > 0));
};

const normalizeLabelValues = (value?: Record<string, string | string[]>) =>
  Object.fromEntries(
    Object.entries(value ?? {}).flatMap(([name, rawValue]) => {
      const values = normalizeStringArray(rawValue);

      return values.length ? [[name, values]] : [];
    }),
  );

const toExpectationSelector = (input?: AgentHarnessScopeInput): AgentExpectationSelector | undefined => {
  if (!input) {
    return undefined;
  }

  const environments = normalizeStringArray(input.environments);
  const fullNames = normalizeStringArray(input.fullNames);
  const fullNamePrefixes = normalizeStringArray(input.fullNamePrefixes);
  const labelValues = normalizeLabelValues(input.labelValues);

  if (!environments.length && !fullNames.length && !fullNamePrefixes.length && !Object.keys(labelValues).length) {
    return undefined;
  }

  return {
    ...(environments.length ? { environments } : {}),
    ...(fullNames.length ? { full_names: fullNames } : {}),
    ...(fullNamePrefixes.length ? { full_name_prefixes: fullNamePrefixes } : {}),
    ...(Object.keys(labelValues).length ? { label_values: labelValues } : {}),
  };
};

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf-8")) as T;

const readJsonl = async <T>(path: string): Promise<T[]> =>
  (await readFile(path, "utf-8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

const countByActionCategory = (items: AgentEnrichmentPlanItem[]) =>
  items.reduce<Record<AgentEnrichmentActionCategory, number>>(
    (counts, item) => {
      counts[item.category] += 1;

      return counts;
    },
    {
      "bootstrap-allure": 0,
      "narrow-test-scope": 0,
      "repair-test-metadata": 0,
      "add-meaningful-steps": 0,
      "add-test-attachments": 0,
      "add-retry-diagnostics": 0,
      "collapse-low-signal-trace": 0,
      "review-manually": 0,
    },
  );

const sortPlan = (items: AgentEnrichmentPlanItem[]) =>
  [...items].sort((left, right) => {
    const byImpact = IMPACT_ORDER[left.acceptanceImpact] - IMPACT_ORDER[right.acceptanceImpact];

    if (byImpact !== 0) {
      return byImpact;
    }

    const bySeverity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];

    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byCategory = left.category.localeCompare(right.category);

    if (byCategory !== 0) {
      return byCategory;
    }

    const bySubject = left.subject.localeCompare(right.subject);

    if (bySubject !== 0) {
      return bySubject;
    }

    return left.checkName.localeCompare(right.checkName);
  });

const impactForFinding = (
  finding: AgentFindingManifestLine,
  antiDummyConfidenceThreshold: number,
): AgentAcceptanceImpact => {
  if (SCOPE_REJECTING_CHECKS.includes(finding.check_name as (typeof SCOPE_REJECTING_CHECKS)[number])) {
    return "reject";
  }

  if (
    ANTI_DUMMY_CHECKS.includes(finding.check_name as (typeof ANTI_DUMMY_CHECKS)[number]) &&
    (finding.confidence ?? 0) >= antiDummyConfidenceThreshold
  ) {
    return "reject";
  }

  if (ITERATION_REQUIRED_CHECKS.includes(finding.check_name as (typeof ITERATION_REQUIRED_CHECKS)[number])) {
    return "iterate";
  }

  if (finding.severity === "high") {
    return "iterate";
  }

  return "advisory";
};

export const buildAgentExpectations = (input: AgentHarnessRequest): AgentExpectations => {
  const expected = toExpectationSelector(input.target ?? input.expected);
  const forbidden = toExpectationSelector(input.forbidden);
  const notes = normalizeStringArray(input.notes);

  return {
    ...(input.goal ? { goal: input.goal } : {}),
    ...(input.taskId ? { task_id: input.taskId } : {}),
    ...(expected ? { expected } : {}),
    ...(forbidden ? { forbidden } : {}),
    ...(notes.length ? { notes } : {}),
  };
};

export const mapFindingToEnrichmentAction = (finding: AgentFindingManifestLine | string): AgentEnrichmentAction => {
  const checkName = typeof finding === "string" ? finding : finding.check_name;
  const mapped = AGENT_ENRICHMENT_ACTIONS[checkName];

  return mapped ?? { ...FALLBACK_ACTION, checkName };
};

export const loadAgentOutput = async (outputDir: string): Promise<AgentOutputBundle> => {
  const absoluteOutputDir = resolve(outputDir);
  const run = await readJson<AgentRunManifest>(join(absoluteOutputDir, "manifest", "run.json"));
  const tests = await readJsonl<AgentTestManifestLine>(join(absoluteOutputDir, "manifest", "tests.jsonl"));
  const findings = await readJsonl<AgentFindingManifestLine>(join(absoluteOutputDir, "manifest", "findings.jsonl"));
  const expected =
    run.paths.expected_manifest && run.expectations_present
      ? await readJson<AgentExpectations>(join(absoluteOutputDir, run.paths.expected_manifest))
      : undefined;

  return {
    outputDir: absoluteOutputDir,
    run,
    tests,
    findings,
    expected,
  };
};

export const planAgentEnrichmentReview = (
  output: AgentOutputBundle,
  options: AgentReviewOptions = {},
): AgentEnrichmentReview => {
  const antiDummyConfidenceThreshold = options.antiDummyConfidenceThreshold ?? DEFAULT_ANTI_DUMMY_CONFIDENCE;
  const requireExpectationsForAcceptance = options.requireExpectationsForAcceptance ?? true;
  const testsByPath = new Map(output.tests.map((test) => [test.markdown_path, test]));
  const plan = sortPlan(
    output.findings.map((finding) => {
      const action = mapFindingToEnrichmentAction(finding);
      const matchedTest = testsByPath.get(finding.subject);

      return {
        ...action,
        subject: finding.subject,
        subjectType: finding.subject === "run" ? "run" : "test",
        severity: finding.severity,
        message: finding.message,
        explanation: finding.explanation,
        remediationHint: finding.remediation_hint,
        evidencePaths: finding.evidence_paths,
        expectedReference: finding.expected_reference,
        confidence: finding.confidence,
        acceptanceImpact: impactForFinding(finding, antiDummyConfidenceThreshold),
        fullName: matchedTest?.full_name,
        markdownPath: matchedTest?.markdown_path,
        scopeMatch: matchedTest?.scope_match,
      } satisfies AgentEnrichmentPlanItem;
    }),
  );
  const rejecting = plan.filter((item) => item.acceptanceImpact === "reject");
  const iterate = plan.filter((item) => item.acceptanceImpact === "iterate");
  const advisory = plan.filter((item) => item.acceptanceImpact === "advisory");
  const notes: string[] = [];

  if (!output.run.expectations_present) {
    notes.push(
      "Generate ALLURE_AGENT_EXPECTATIONS before the next enrichment iteration so scope checks are comparable.",
    );
  }

  if (rejecting.some((item) => item.checkName === "noop-dominated-steps")) {
    notes.push(
      "Reject noop-dominated enrichment: keep only steps tied to real actions or checks, and use real runtime attachments instead of placeholders.",
    );
  }

  if (
    rejecting.some((item) => SCOPE_REJECTING_CHECKS.includes(item.checkName as (typeof SCOPE_REJECTING_CHECKS)[number]))
  ) {
    notes.push("Reject scope drift: rerun only the intended tests and keep forbidden scope in the expectations file.");
  }

  if (!notes.length && !iterate.length && output.run.expectations_present) {
    notes.push("Scope matched expectations and no blocking evidence gaps or anti-dummy findings remain.");
  }

  const status: AgentAcceptanceStatus = rejecting.length
    ? "reject"
    : requireExpectationsForAcceptance && !output.run.expectations_present
      ? "iterate"
      : iterate.length
        ? "iterate"
        : "accept";

  return {
    status,
    outputDir: output.outputDir,
    expectationsPresent: output.run.expectations_present,
    expected: output.expected,
    summary: {
      totalTests: output.tests.length,
      totalFindings: output.findings.length,
      planItems: plan.length,
      rejectingItems: rejecting.length,
      iterationItems: iterate.length,
      advisoryItems: advisory.length,
      countsByActionCategory: countByActionCategory(plan),
    },
    notes,
    plan,
    rejecting,
    iterate,
    advisory,
    rerun: {
      requiresExpectations: requireExpectationsForAcceptance,
      useExistingExpectations: output.run.expectations_present,
      targetedTests: uniqueValues(plan.flatMap((item) => (item.fullName ? [item.fullName] : []))),
    },
  };
};

export const reviewAgentOutput = async (
  outputDir: string,
  options?: AgentReviewOptions,
): Promise<AgentEnrichmentReview> => planAgentEnrichmentReview(await loadAgentOutput(outputDir), options);
