import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import process, { env } from "node:process";
import { parse } from "yaml";

import {
  type AttachmentLink,
  type Statistic,
  type TestError,
  type TestFixtureResult,
  type TestLabel,
  type TestParameter,
  type TestResult,
  type TestStatus,
  type TestStepResult,
  formatDuration,
  isAttachment,
  isStep,
} from "@allurereport/core-api";
import type {
  AllureStore,
  Plugin,
  PluginContext,
  QualityGateValidationResult,
  RealtimeSubscriber,
  ResultFile,
} from "@allurereport/plugin-api";

import { renderAgentsGuide } from "./guidance.js";
import type { AgentPluginOptions } from "./model.js";

const AGENT_OUTPUT_ENV = "ALLURE_AGENT_OUTPUT";
const AGENT_EXPECTATIONS_ENV = "ALLURE_AGENT_EXPECTATIONS";
const AGENT_COMMAND_ENV = "ALLURE_AGENT_COMMAND";
const AGENT_PROJECT_ROOT_ENV = "ALLURE_AGENT_PROJECT_ROOT";
const AGENT_NAME_ENV = "ALLURE_AGENT_NAME";
const AGENT_LOOP_ID_ENV = "ALLURE_AGENT_LOOP_ID";
const AGENT_TASK_ID_ENV = "ALLURE_AGENT_TASK_ID";
const AGENT_CONVERSATION_ID_ENV = "ALLURE_AGENT_CONVERSATION_ID";
const AGENT_SCHEMA_VERSION = "allure-agent-output/v1";
const MANAGED_ENTRIES = ["index.md", "AGENTS.md", "tests", "artifacts", "manifest", "project"] as const;
const STATUS_ORDER: Record<TestStatus, number> = {
  failed: 0,
  broken: 1,
  unknown: 2,
  skipped: 3,
  passed: 4,
};
const FINDING_SEVERITY_ORDER = {
  high: 0,
  warning: 1,
  info: 2,
} as const;
const NONTRIVIAL_DURATION_MS = 100;
const STEP_SPAM_THRESHOLD = 25;
const NOOP_RATIO_THRESHOLD = 0.8;
const ASSERTION_STEP_PATTERN = /\b(assert|expect|check|verify|validate|should)\b/i;
const LOW_VALUE_STDERR_WARNING_PATTERNS = [
  /\bNO_COLOR\b/i,
  /\bExperimentalWarning\b/i,
  /\bDeprecationWarning\b/i,
  /\bAllure TestOps\b/i,
  /\bCJS build of Vite's Node API is deprecated\b/i,
] as const;
const VITEST_SETUP_FRAME_PATTERN = /^\d+\|\s*(beforeAll|beforeEach|afterAll|afterEach)\b/i;
const ACTIONABLE_STDERR_PATTERNS = [
  {
    kind: "setup",
    pattern: /\b(xcresulttool|xcrun: error: unable to find utility|not a developer tool or in PATH)\b/i,
  },
  {
    kind: "import",
    pattern:
      /\b(ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Failed to resolve import|Failed to load url|Module not found)\b/i,
  },
  {
    kind: "suite-load",
    pattern: /\b(Unhandled Error|Error while loading|Failed to load test file|Failed to collect tests)\b/i,
  },
  {
    kind: "setup",
    pattern: /\b(beforeAll|beforeEach|afterAll|afterEach|global setup|setup failed|setup error)\b/i,
  },
] as const;
const STACK_TRACE_LINE_PATTERN = /^\s*(at\s+|file:|node:internal|Caused by:\s*$|\^+$)/;

type FindingSeverity = "info" | "warning" | "high";
type FindingCategory = "bootstrap" | "scope" | "metadata" | "evidence" | "smells";
type ScopeMatch = "match" | "unexpected" | "forbidden" | "unknown";
type ModelingCompleteness = "complete" | "partial";
type RunnerIssueKind = "import" | "suite-load" | "setup" | "global-error";

type AttachmentReference = {
  link: AttachmentLink;
  source: string;
};

type MaterializedArtifact = {
  id: string;
  displayName: string;
  sources: string[];
  contentType?: string;
  contentLength?: number;
  relativePath?: string;
  missing: boolean;
};

type StepTreeSummary = {
  totalSteps: number;
  noopSteps: number;
  meaningfulSteps: number;
  nestedSteps: number;
  attachmentRefs: number;
  assertionLikeSteps: number;
};

type StatusCounts = {
  total: number;
  failed: number;
  broken: number;
  unknown: number;
  skipped: number;
  passed: number;
};

type RunnerIssueSummary = {
  source: "stderr" | "global_error";
  kind: RunnerIssueKind;
  message: string;
  count: number;
};

type StderrClassification = {
  actionable: RunnerIssueSummary[];
  noisyWarnings: Array<{
    message: string;
    count: number;
  }>;
};

type ModelingSummary = {
  completeness: ModelingCompleteness;
  reasons: string[];
  modeledStats: StatusCounts;
  unmodeledFromStats: StatusCounts;
  runnerFailures: {
    total: number;
    globalErrors: number;
    stderrActionable: number;
    samples: RunnerIssueSummary[];
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
    completeness: ModelingCompleteness;
  };
};

type RunPhase = "running" | "done";

type TestEventType = "test_completed" | "test_updated" | "run_warning" | "run_error" | "run_finished";

type AgentSnapshot = {
  stats: Statistic;
  entries: TestEntry[];
  globalArtifacts: MaterializedArtifact[];
  globalErrors: TestError[];
  globalExitCode?: { actual?: number; original: number };
  qualityGateResults: QualityGateValidationResult[];
  modelingSummary: ModelingSummary;
  durationSummary: {
    total: number;
    average: number;
    max: number;
  };
  combinedRunFindings: AgentFinding[];
  combinedAllFindings: AgentFinding[];
};

type AgentRuntimeState = {
  outputDir: string;
  context: PluginContext;
  store: AllureStore;
  generatedAt: string;
  command?: string;
  createFinding: ReturnType<typeof createFindingFactory>;
  expectations?: LoadedExpectations;
  expectationLoadFindings: AgentFinding[];
  projectGuide?: LoadedProjectGuide;
  unsubscribers: Array<() => void>;
  queue: Promise<void>;
  lastError?: Error;
  seenLogicalKeys: Set<string>;
  currentTestPaths: Set<string>;
  currentAssetDirs: Set<string>;
  currentEntryPathByTestId: Map<string, string>;
  currentAssetDirByTestId: Map<string, string>;
  finalized: boolean;
  eventCounter: number;
};

type TestEntryLayout = {
  tr: TestResult;
  environmentId: string;
  environmentPath: string;
  slug: string;
  relativePath: string;
  filePath: string;
  assetDir: string;
  relativeAssetDir: string;
  historyCollision: boolean;
};

type AttemptRecord = {
  heading: string;
  tr: TestResult;
  fixtures: TestFixtureResult[];
  artifacts: MaterializedArtifact[];
  stepSummary: StepTreeSummary;
  fixtureStepSummary: StepTreeSummary;
};

type AgentFinding = {
  findingId: string;
  subject: string;
  subjectType: "run" | "test";
  severity: FindingSeverity;
  category: FindingCategory;
  checkName: string;
  message: string;
  explanation: string;
  evidencePaths: string[];
  remediationHint: string;
  expectedReference?: string;
  confidence?: number;
};

type ExpectationSelectorInput = {
  environments?: string[];
  full_names?: string[];
  full_name_prefixes?: string[];
  label_values?: Record<string, string | string[]>;
};

type ExpectationsInput = {
  goal?: string;
  task_id?: string;
  expected?: ExpectationSelectorInput;
  forbidden?: ExpectationSelectorInput;
  notes?: string | string[];
};

type NormalizedExpectationSelectors = {
  environments: string[];
  fullNames: string[];
  fullNamePrefixes: string[];
  labelValues: Record<string, string[]>;
};

type LoadedExpectations = {
  sourcePath: string;
  relativePath: string;
  raw: ExpectationsInput;
  goal?: string;
  taskId?: string;
  notes: string[];
  expected: NormalizedExpectationSelectors;
  forbidden: NormalizedExpectationSelectors;
};

type LoadedProjectGuide = {
  sourcePath: string;
  relativePath: string;
};

type ScopeEvaluation = {
  scopeMatch: ScopeMatch;
  reasons: string[];
  expectedReferences: string[];
  metadataMismatches: string[];
};

type TestEntry = {
  key: string;
  tr: TestResult;
  environmentId: string;
  environmentPath: string;
  slug: string;
  relativePath: string;
  filePath: string;
  relativeAssetDir: string;
  attempts: AttemptRecord[];
  allArtifacts: MaterializedArtifact[];
  findings: AgentFinding[];
  scope: ScopeEvaluation;
  packageName?: string;
  historyCollision: boolean;
};

const normalizeMarkdownPath = (value: string) => value.replace(/\\/g, "/");

const escapeInlineMarkdown = (value: string) => value.replace(/\\/g, "\\\\").replace(/([`*_[\]<>])/g, "\\$1");

const sanitizePathSegment = (value: string | undefined, fallback: string) => {
  const sanitized = (value ?? fallback).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");

  return sanitized.length > 0 ? sanitized : fallback;
};

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const attachmentName = (link: AttachmentLink) => ("name" in link ? link.name : undefined);

const attachmentDisplayName = (link: AttachmentLink) => attachmentName(link) ?? link.originalFileName ?? link.id;

const statusLabel = (status: TestStatus) => status.toUpperCase();

const compareTestResultsByStatusThenName = (left: TestResult, right: TestResult) => {
  const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];

  if (byStatus !== 0) {
    return byStatus;
  }

  const leftName = left.fullName ?? left.name;
  const rightName = right.fullName ?? right.name;
  const byName = leftName.localeCompare(rightName);

  if (byName !== 0) {
    return byName;
  }

  return left.id.localeCompare(right.id);
};

const sortByNewestAttempt = (items: TestResult[]) =>
  [...items].sort((left, right) => {
    const byStart = (right.start ?? 0) - (left.start ?? 0);

    if (byStart !== 0) {
      return byStart;
    }

    const byStop = (right.stop ?? 0) - (left.stop ?? 0);

    if (byStop !== 0) {
      return byStop;
    }

    return right.id.localeCompare(left.id);
  });

const formatTimestamp = (value?: number) => (value === undefined ? "unknown" : new Date(value).toISOString());

const formatDurationValue = (value?: number) => formatDuration(value);

const escapeJsonPointerSegment = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1");

const isFailedLikeStatus = (status: TestStatus) => status === "failed" || status === "broken";

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
};

const normalizeLabelValues = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([name, rawValue]) => {
      const values =
        typeof rawValue === "string" ? [rawValue] : Array.isArray(rawValue) ? rawValue.filter((item): item is string => typeof item === "string") : [];

      return values.length ? [[name, values]] : [];
    }),
  );
};

const normalizeSelectors = (input?: ExpectationSelectorInput): NormalizedExpectationSelectors => ({
  environments: normalizeStringArray(input?.environments),
  fullNames: normalizeStringArray(input?.full_names),
  fullNamePrefixes: normalizeStringArray(input?.full_name_prefixes),
  labelValues: normalizeLabelValues(input?.label_values),
});

const hasSelector = (selectors: NormalizedExpectationSelectors) =>
  selectors.environments.length > 0 ||
  selectors.fullNames.length > 0 ||
  selectors.fullNamePrefixes.length > 0 ||
  Object.keys(selectors.labelValues).length > 0;

const normalizeNotes = (value: string | string[] | undefined) => {
  if (typeof value === "string") {
    return value.length > 0 ? [value] : [];
  }

  return normalizeStringArray(value);
};

const formatLabelRequirement = (name: string, values: string[]) => `${name} in [${values.join(", ")}]`;

const buildLabelRecord = (labels: TestLabel[]) => {
  const record = new Map<string, string[]>();

  for (const label of labels) {
    if (label.value === undefined) {
      continue;
    }

    const current = record.get(label.name) ?? [];

    current.push(label.value);
    record.set(label.name, current);
  }

  return record;
};

const matchesLabelSelectors = (labels: TestLabel[], selector: Record<string, string[]>) => {
  const labelRecord = buildLabelRecord(labels);

  return Object.entries(selector).every(([name, values]) => {
    const actual = labelRecord.get(name) ?? [];

    return actual.some((value) => values.includes(value));
  });
};

const collectMissingLabelSelectors = (labels: TestLabel[], selector: Record<string, string[]>) => {
  const labelRecord = buildLabelRecord(labels);
  const mismatches: string[] = [];

  for (const [name, values] of Object.entries(selector)) {
    const actual = labelRecord.get(name) ?? [];

    if (!actual.some((value) => values.includes(value))) {
      mismatches.push(`missing ${formatLabelRequirement(name, values)}`);
    }
  }

  return mismatches;
};

const matchSelectors = (params: {
  tr: TestResult;
  environmentId: string;
  selectors: NormalizedExpectationSelectors;
  selectorRoot: "expected" | "forbidden";
}) => {
  const { tr, environmentId, selectors, selectorRoot } = params;
  const fullName = tr.fullName ?? tr.name;
  const reasons: string[] = [];
  const references: string[] = [];

  selectors.fullNames.forEach((candidate, index) => {
    if (candidate === fullName) {
      reasons.push("full name");
      references.push(`${selectorRoot}.full_names[${index}]`);
    }
  });
  selectors.fullNamePrefixes.forEach((candidate, index) => {
    if (fullName.startsWith(candidate)) {
      reasons.push("full name prefix");
      references.push(`${selectorRoot}.full_name_prefixes[${index}]`);
    }
  });
  selectors.environments.forEach((candidate, index) => {
    if (candidate === environmentId || sanitizePathSegment(candidate, candidate) === sanitizePathSegment(environmentId, environmentId)) {
      reasons.push("environment");
      references.push(`${selectorRoot}.environments[${index}]`);
    }
  });

  const labelSelectorsPresent = Object.keys(selectors.labelValues).length > 0;
  const labelMatch = labelSelectorsPresent ? matchesLabelSelectors(tr.labels, selectors.labelValues) : false;

  if (labelMatch) {
    reasons.push("label values");
    references.push(...Object.keys(selectors.labelValues).map((name) => `${selectorRoot}.label_values/${escapeJsonPointerSegment(name)}`));
  }

  return {
    matched: reasons.length > 0,
    matchedByNonLabel:
      reasons.includes("full name") || reasons.includes("full name prefix") || reasons.includes("environment"),
    labelMatch,
    reasons: uniqueValues(reasons),
    references: uniqueValues(references),
  };
};

const analyzeStepTree = (steps: TestStepResult[]): StepTreeSummary => {
  const summary: StepTreeSummary = {
    totalSteps: 0,
    noopSteps: 0,
    meaningfulSteps: 0,
    nestedSteps: 0,
    attachmentRefs: 0,
    assertionLikeSteps: 0,
  };

  const visit = (nodes: TestStepResult[]) => {
    for (const node of nodes) {
      if (isAttachment(node)) {
        summary.attachmentRefs += 1;
        continue;
      }

      if (!isStep(node)) {
        continue;
      }

      summary.totalSteps += 1;

      const hasNestedSteps = node.steps.some(isStep);
      const hasAttachmentChildren = node.steps.some(isAttachment);
      const hasEvidence =
        node.parameters.length > 0 ||
        !!node.error?.message ||
        !!node.message ||
        !!node.trace ||
        hasNestedSteps ||
        hasAttachmentChildren;

      if (hasNestedSteps) {
        summary.nestedSteps += 1;
      }

      if (ASSERTION_STEP_PATTERN.test(node.name)) {
        summary.assertionLikeSteps += 1;
      }

      if (hasEvidence) {
        summary.meaningfulSteps += 1;
      } else {
        summary.noopSteps += 1;
      }

      if (node.steps.length) {
        visit(node.steps);
      }
    }
  };

  visit(steps);

  return summary;
};

const mergeStepSummaries = (items: StepTreeSummary[]) =>
  items.reduce<StepTreeSummary>(
    (acc, item) => ({
      totalSteps: acc.totalSteps + item.totalSteps,
      noopSteps: acc.noopSteps + item.noopSteps,
      meaningfulSteps: acc.meaningfulSteps + item.meaningfulSteps,
      nestedSteps: acc.nestedSteps + item.nestedSteps,
      attachmentRefs: acc.attachmentRefs + item.attachmentRefs,
      assertionLikeSteps: acc.assertionLikeSteps + item.assertionLikeSteps,
    }),
    {
      totalSteps: 0,
      noopSteps: 0,
      meaningfulSteps: 0,
      nestedSteps: 0,
      attachmentRefs: 0,
      assertionLikeSteps: 0,
    },
  );

const buildAttemptSignature = (attempt: AttemptRecord) =>
  JSON.stringify({
    status: attempt.tr.status,
    errorMessage: attempt.tr.error?.message,
    errorTrace: attempt.tr.error?.trace,
    stepSummary: attempt.stepSummary,
    fixtureSummary: attempt.fixtureStepSummary,
    artifactNames: attempt.artifacts.map((artifact) => ({
      name: artifact.displayName,
      missing: artifact.missing,
    })),
  });

const getPackageName = (tr: TestResult) => tr.labels.find(({ name }) => name === "package")?.value;

const toLabelEntries = (labels: TestLabel[]) =>
  labels.map((label) => ({
    name: label.name,
    value: label.value,
  }));

const toFindingCounts = (findings: AgentFinding[]) => {
  const counts = {
    total: findings.length,
    high: 0,
    warning: 0,
    info: 0,
  };

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return counts;
};

const buildEnvironmentSummary = (entries: TestEntry[]) => {
  const byEnvironment = new Map<string, { total: number; failed: number; broken: number; skipped: number; unknown: number; passed: number }>();

  for (const entry of entries) {
    const bucket =
      byEnvironment.get(entry.environmentId) ?? {
        total: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        unknown: 0,
        passed: 0,
      };

    bucket.total += 1;
    bucket[entry.tr.status] += 1;
    byEnvironment.set(entry.environmentId, bucket);
  }

  return Array.from(byEnvironment.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([environmentId, stats]) => ({
      environmentId,
      ...stats,
    }));
};

const emptyStatusCounts = (): StatusCounts => ({
  total: 0,
  failed: 0,
  broken: 0,
  unknown: 0,
  skipped: 0,
  passed: 0,
});

const toStatusCountsFromStatistic = (stats: Statistic): StatusCounts => ({
  total: stats.total ?? 0,
  failed: stats.failed ?? 0,
  broken: stats.broken ?? 0,
  unknown: stats.unknown ?? 0,
  skipped: stats.skipped ?? 0,
  passed: stats.passed ?? 0,
});

const toStatusCountsFromEntries = (entries: TestEntry[]): StatusCounts => {
  const counts = emptyStatusCounts();

  for (const entry of entries) {
    counts.total += 1;
    counts[entry.tr.status] += 1;
  }

  return counts;
};

const subtractStatusCounts = (left: StatusCounts, right: StatusCounts): StatusCounts => ({
  total: Math.max(left.total - right.total, 0),
  failed: Math.max(left.failed - right.failed, 0),
  broken: Math.max(left.broken - right.broken, 0),
  unknown: Math.max(left.unknown - right.unknown, 0),
  skipped: Math.max(left.skipped - right.skipped, 0),
  passed: Math.max(left.passed - right.passed, 0),
});

const summarizeStatusCounts = (counts: StatusCounts) =>
  `${counts.total} total (${counts.failed} failed, ${counts.broken} broken, ${counts.unknown} unknown, ${counts.skipped} skipped, ${counts.passed} passed)`;

const normalizeLogLine = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeWarningLine = (value: string) =>
  normalizeLogLine(value).replace(/^\(node:\d+\)\s+Warning:\s*/i, "Warning: ");

const buildCountedValues = (values: string[]) => {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));
};

const classifyRunnerIssueKind = (value: string): RunnerIssueKind | undefined => {
  const normalized = normalizeLogLine(value);

  for (const { kind, pattern } of ACTIONABLE_STDERR_PATTERNS) {
    if (pattern.test(normalized)) {
      return kind;
    }
  }

  return undefined;
};

const classifyStderr = (content?: string): StderrClassification => {
  if (!content?.trim()) {
    return {
      actionable: [],
      noisyWarnings: [],
    };
  }

  const actionableLines: RunnerIssueSummary[] = [];
  const warningLines: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = normalizeLogLine(rawLine);

    if (!line || STACK_TRACE_LINE_PATTERN.test(rawLine) || VITEST_SETUP_FRAME_PATTERN.test(line)) {
      continue;
    }

    if (LOW_VALUE_STDERR_WARNING_PATTERNS.some((pattern) => pattern.test(line))) {
      warningLines.push(normalizeWarningLine(line));
      continue;
    }

    const kind = classifyRunnerIssueKind(line);

    if (kind) {
      actionableLines.push({
        source: "stderr",
        kind,
        message: line,
        count: 1,
      });
    }
  }

  const actionable = Array.from(
    actionableLines.reduce((acc, issue) => {
      const key = `${issue.source}:${issue.kind}:${issue.message}`;
      const current = acc.get(key);

      if (current) {
        current.count += 1;
      } else {
        acc.set(key, { ...issue });
      }

      return acc;
    }, new Map<string, RunnerIssueSummary>()),
  )
    .map(([, issue]) => issue)
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));

  return {
    actionable,
    noisyWarnings: buildCountedValues(warningLines),
  };
};

const summarizeGlobalErrors = (errors: TestError[]) =>
  errors
    .map((error) => normalizeLogLine(error.message ?? error.trace?.split(/\r?\n/)[0] ?? ""))
    .filter(Boolean)
    .map((message) => ({
      source: "global_error" as const,
      kind: classifyRunnerIssueKind(message) ?? "global-error",
      message,
      count: 1,
    }))
    .reduce((acc, issue) => {
      const key = `${issue.source}:${issue.kind}:${issue.message}`;
      const current = acc.get(key);

      if (current) {
        current.count += 1;
      } else {
        acc.set(key, issue);
      }

      return acc;
    }, new Map<string, RunnerIssueSummary>());

const toRunnerIssueArray = (issues: Map<string, RunnerIssueSummary>) =>
  Array.from(issues.values()).sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));

const buildModelingSummary = (params: {
  entries: TestEntry[];
  stats: Statistic;
  globalErrors: TestError[];
  stderrContent?: string;
}) => {
  const { entries, stats, globalErrors, stderrContent } = params;
  const visibleResults = toStatusCountsFromStatistic(stats);
  const modeledStats = toStatusCountsFromEntries(entries);
  const unmodeledFromStats = subtractStatusCounts(visibleResults, modeledStats);
  const stderr = classifyStderr(stderrContent);
  const globalErrorIssues = toRunnerIssueArray(summarizeGlobalErrors(globalErrors));
  const stderrActionableCount = stderr.actionable.reduce((acc, issue) => acc + issue.count, 0);
  const stderrWarningCount = stderr.noisyWarnings.reduce((acc, issue) => acc + issue.count, 0);
  const runnerFailureSamples = [...globalErrorIssues, ...stderr.actionable].sort(
    (left, right) => right.count - left.count || left.message.localeCompare(right.message),
  );
  const reasons: string[] = [];

  if (unmodeledFromStats.total > 0) {
    reasons.push(`Visible results were not fully rendered as logical tests: ${summarizeStatusCounts(unmodeledFromStats)}`);
  }

  if (globalErrors.length + stderrActionableCount > 0) {
    reasons.push(`${globalErrors.length + stderrActionableCount} runner-level failures were detected outside logical test files.`);
  }

  const completeness: ModelingCompleteness = reasons.length > 0 ? "partial" : "complete";

  return {
    completeness,
    reasons,
    modeledStats,
    unmodeledFromStats,
    runnerFailures: {
      total: globalErrors.length + stderrActionableCount,
      globalErrors: globalErrors.length,
      stderrActionable: stderrActionableCount,
      samples: runnerFailureSamples.slice(0, 5),
    },
    stderr: {
      actionableCount: stderrActionableCount,
      actionableSamples: stderr.actionable.slice(0, 5).map((issue) => issue.message),
      noisyWarningCount: stderrWarningCount,
      noisyWarningSamples: stderr.noisyWarnings.slice(0, 5).map((warning) => warning.message),
    },
    compact: {
      visible_results: visibleResults.total,
      logical_tests: modeledStats.total,
      unmodeled_visible_results: unmodeledFromStats.total,
      runner_failures_outside_logical_tests: runnerFailureSamples.length,
      completeness,
    },
  } satisfies ModelingSummary;
};

const renderCodeBlock = (content?: string) => {
  if (!content?.trim()) {
    return undefined;
  }

  return `~~~text\n${content.trimEnd()}\n~~~`;
};

const renderParameters = (parameters: TestParameter[]) => {
  if (!parameters.length) {
    return "None";
  }

  return parameters
    .map((parameter) => {
      const markers: string[] = [];
      let value = parameter.value;

      if (parameter.hidden) {
        value = "<hidden>";
      } else if (parameter.masked) {
        value = "<masked>";
      }

      if (parameter.excluded) {
        markers.push("excluded");
      }

      const suffix = markers.length ? ` (${markers.join(", ")})` : "";

      return `- ${escapeInlineMarkdown(parameter.name)}: ${escapeInlineMarkdown(value)}${suffix}`;
    })
    .join("\n");
};

const renderLabels = (labels: TestLabel[]) => {
  if (!labels.length) {
    return "None";
  }

  return labels
    .map(({ name, value }) => {
      if (value === undefined) {
        return `- ${escapeInlineMarkdown(name)}`;
      }

      return `- ${escapeInlineMarkdown(name)}: ${escapeInlineMarkdown(value)}`;
    })
    .join("\n");
};

const renderLinks = (links: TestResult["links"]) => {
  if (!links.length) {
    return "None";
  }

  return links
    .map(({ name, type, url }) => {
      const labelParts = [type, name].filter(Boolean).map((part) => escapeInlineMarkdown(part!));
      const label = labelParts.length ? labelParts.join(" / ") : escapeInlineMarkdown(url);

      return `- [${label}](${url})`;
    })
    .join("\n");
};

const renderOptionalMarkdownSection = (title: string, content?: string) => {
  if (!content?.trim()) {
    return undefined;
  }

  return `## ${title}\n\n${content.trim()}`;
};

const renderError = (error?: TestError) => {
  if (!error || (!error.message && !error.trace && !error.actual && !error.expected)) {
    return "None";
  }

  const lines: string[] = [];

  if (error.message) {
    lines.push(`- Message: ${escapeInlineMarkdown(error.message)}`);
  }

  if (error.actual !== undefined) {
    lines.push(`- Actual: ${escapeInlineMarkdown(error.actual)}`);
  }

  if (error.expected !== undefined) {
    lines.push(`- Expected: ${escapeInlineMarkdown(error.expected)}`);
  }

  const trace = renderCodeBlock(error.trace);

  if (trace) {
    lines.push("- Trace:");
    lines.push("");
    lines.push(trace);
  }

  return lines.join("\n");
};

const renderArtifactLine = (artifact: MaterializedArtifact, includeSources: boolean) => {
  const details: string[] = [];

  if (artifact.contentType) {
    details.push(artifact.contentType);
  }

  if (artifact.contentLength !== undefined) {
    details.push(`${artifact.contentLength} bytes`);
  }

  const detailsSuffix = details.length ? ` (${details.join(", ")})` : "";
  const sourceSuffix = includeSources && artifact.sources.length ? ` [sources: ${artifact.sources.join("; ")}]` : "";

  if (artifact.relativePath) {
    return `- [${escapeInlineMarkdown(artifact.displayName)}](${normalizeMarkdownPath(artifact.relativePath)})${detailsSuffix}${sourceSuffix}`;
  }

  return `- ${escapeInlineMarkdown(artifact.displayName)} (missing attachment)${sourceSuffix}`;
};

const formatParameterSummary = (parameter: TestParameter) => {
  if (parameter.hidden) {
    return `${parameter.name}=<hidden>`;
  }

  if (parameter.masked) {
    return `${parameter.name}=<masked>`;
  }

  return `${parameter.name}=${parameter.value}`;
};

const renderStepTree = (
  steps: TestStepResult[],
  artifactLookup: Map<string, MaterializedArtifact>,
  indent: number = 0,
): string => {
  if (!steps.length) {
    return `${"  ".repeat(indent)}- No steps`;
  }

  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const step of steps) {
    if (isAttachment(step)) {
      const artifact = artifactLookup.get(step.link.id);
      const displayName = attachmentDisplayName(step.link);

      if (artifact?.relativePath) {
        lines.push(
          `${prefix}- Attachment: [${escapeInlineMarkdown(displayName)}](${normalizeMarkdownPath(artifact.relativePath)})`,
        );
      } else {
        lines.push(`${prefix}- Attachment: ${escapeInlineMarkdown(displayName)} (missing attachment)`);
      }

      continue;
    }

    if (!isStep(step)) {
      continue;
    }

    const titleParts = [`[${statusLabel(step.status)}]`, escapeInlineMarkdown(step.name)];

    if (step.duration !== undefined) {
      titleParts.push(`(${formatDurationValue(step.duration)})`);
    }

    lines.push(`${prefix}- ${titleParts.join(" ")}`);

    if (step.parameters.length) {
      lines.push(`${prefix}  - Parameters: ${step.parameters.map(formatParameterSummary).join(", ")}`);
    }

    if (step.error?.message) {
      lines.push(`${prefix}  - Error: ${escapeInlineMarkdown(step.error.message)}`);
    }

    if (step.steps.length) {
      lines.push(renderStepTree(step.steps, artifactLookup, indent + 1));
    }
  }

  return lines.join("\n");
};

const renderFixtureSections = (fixtures: TestFixtureResult[], artifactLookup: Map<string, MaterializedArtifact>) => {
  if (!fixtures.length) {
    return "None";
  }

  return fixtures
    .map((fixture) =>
      [
        `### ${fixture.type === "before" ? "Before" : "After"} Fixture: ${escapeInlineMarkdown(fixture.name)}`,
        "",
        `- Status: ${statusLabel(fixture.status)}`,
        `- Duration: ${formatDurationValue(fixture.duration)}`,
        `- Started: ${formatTimestamp(fixture.start)}`,
        `- Stopped: ${formatTimestamp(fixture.stop)}`,
        "",
        "#### Error",
        "",
        renderError(fixture.error),
        "",
        "#### Steps",
        "",
        renderStepTree(fixture.steps, artifactLookup),
      ].join("\n"),
    )
    .join("\n\n");
};

const renderAttemptSection = (attempt: AttemptRecord) => {
  const artifactLookup = new Map(attempt.artifacts.map((artifact) => [artifact.id, artifact]));

  return [
    `## ${attempt.heading}`,
    "",
    `- Status: ${statusLabel(attempt.tr.status)}`,
    `- Duration: ${formatDurationValue(attempt.tr.duration)}`,
    `- Started: ${formatTimestamp(attempt.tr.start)}`,
    `- Stopped: ${formatTimestamp(attempt.tr.stop)}`,
    `- Steps Recorded: ${attempt.stepSummary.totalSteps}`,
    `- Attachments Recorded: ${attempt.artifacts.length}`,
    "",
    "### Error",
    "",
    renderError(attempt.tr.error),
    "",
    "### Fixtures",
    "",
    renderFixtureSections(attempt.fixtures, artifactLookup),
    "",
    "### Attachments",
    "",
    attempt.artifacts.length ? attempt.artifacts.map((artifact) => renderArtifactLine(artifact, false)).join("\n") : "None",
    "",
    "### Steps",
    "",
    renderStepTree(attempt.tr.steps, artifactLookup),
  ].join("\n");
};

const renderQualityGateSection = (results: QualityGateValidationResult[]) => {
  if (!results.length) {
    return undefined;
  }

  const failed = results.filter(({ success }) => !success);
  const lines = [
    "## Quality Gate",
    "",
    `- Rules evaluated: ${results.length}`,
    `- Failed rules: ${failed.length}`,
  ];

  if (failed.length) {
    lines.push("");
    lines.push("### Failures");
    lines.push("");
    lines.push(
      failed
        .map((result) => {
          const environmentPrefix = result.environment ? `[${result.environment}] ` : "";

          return `- ${environmentPrefix}${escapeInlineMarkdown(result.rule)}: ${escapeInlineMarkdown(result.message)}`;
        })
        .join("\n"),
    );
  }

  return lines.join("\n");
};

const renderGlobalErrors = (errors: TestError[]) => {
  if (!errors.length) {
    return undefined;
  }

  return [
    "## Global Errors",
    "",
    ...errors.flatMap((error, index) => {
      const lines = [`### Error ${index + 1}`, "", renderError(error)];

      return [lines.join("\n"), ""];
    }),
  ]
    .join("\n")
    .trimEnd();
};

const renderRunnerIssueSummary = (issue: RunnerIssueSummary) => {
  const countSuffix = issue.count > 1 ? ` (${issue.count}x)` : "";

  return `- [${issue.source.replace("_", " ")}/${issue.kind}] ${escapeInlineMarkdown(issue.message)}${countSuffix}`;
};

const renderModelingSummary = (modeling: ModelingSummary) => {
  const lines = [
    "## Runtime Modeling Summary",
    "",
    `- completeness: ${modeling.completeness}`,
    `- visible results from stats: ${modeling.compact.visible_results}`,
    `- logical tests rendered: ${modeling.compact.logical_tests}`,
    `- unmodeled visible results: ${summarizeStatusCounts(modeling.unmodeledFromStats)}`,
    `- runner failures outside logical tests: ${modeling.runnerFailures.total}`,
    `- actionable stderr signals: ${modeling.stderr.actionableCount}`,
    `- repeated low-value warnings: ${modeling.stderr.noisyWarningCount}`,
  ];

  if (modeling.reasons.length) {
    lines.push(`- reasons: ${modeling.reasons.map((reason) => escapeInlineMarkdown(reason)).join(" | ")}`);
  }

  lines.push("");
  lines.push("### High-Signal Runner Issues");
  lines.push("");
  lines.push(modeling.runnerFailures.samples.length ? modeling.runnerFailures.samples.map(renderRunnerIssueSummary).join("\n") : "None");
  lines.push("");
  lines.push("### Repeated Low-Value Warnings");
  lines.push("");
  lines.push(
    modeling.stderr.noisyWarningSamples.length
      ? modeling.stderr.noisyWarningSamples
          .map((warning) => `- ${escapeInlineMarkdown(warning)}`)
          .join("\n")
      : "None",
  );

  return lines.join("\n");
};

const renderSelectorSummary = (title: string, selectors: NormalizedExpectationSelectors) => {
  if (!hasSelector(selectors)) {
    return `- ${title}: None`;
  }

  const parts: string[] = [];

  if (selectors.environments.length) {
    parts.push(`environments: ${selectors.environments.join(", ")}`);
  }

  if (selectors.fullNames.length) {
    parts.push(`full names: ${selectors.fullNames.join(", ")}`);
  }

  if (selectors.fullNamePrefixes.length) {
    parts.push(`prefixes: ${selectors.fullNamePrefixes.join(", ")}`);
  }

  const labelParts = Object.entries(selectors.labelValues).map(([name, values]) => formatLabelRequirement(name, values));

  if (labelParts.length) {
    parts.push(`labels: ${labelParts.join("; ")}`);
  }

  return `- ${title}: ${parts.join(" | ")}`;
};

const buildCheckSummary = (findings: AgentFinding[]) => {
  const countsBySeverity = {
    high: 0,
    warning: 0,
    info: 0,
  };
  const countsByCategory: Record<FindingCategory, number> = {
    bootstrap: 0,
    scope: 0,
    metadata: 0,
    evidence: 0,
    smells: 0,
  };

  for (const finding of findings) {
    countsBySeverity[finding.severity] += 1;
    countsByCategory[finding.category] += 1;
  }

  return {
    total: findings.length,
    countsBySeverity,
    countsByCategory,
  };
};

const sortFindings = (findings: AgentFinding[]) =>
  [...findings].sort((left, right) => {
    const bySeverity = FINDING_SEVERITY_ORDER[left.severity] - FINDING_SEVERITY_ORDER[right.severity];

    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byCategory = left.category.localeCompare(right.category);

    if (byCategory !== 0) {
      return byCategory;
    }

    return left.findingId.localeCompare(right.findingId);
  });

const renderFindingEvidenceLinks = (params: {
  finding: AgentFinding;
  currentFilePath: string;
  outputDir: string;
}) => {
  const { finding, currentFilePath, outputDir } = params;

  if (!finding.evidencePaths.length) {
    return "None";
  }

  return finding.evidencePaths
    .map((evidencePath) => {
      const absolutePath = join(outputDir, evidencePath);
      const markdownPath = normalizeMarkdownPath(relative(dirname(currentFilePath), absolutePath));

      return `- [${escapeInlineMarkdown(evidencePath)}](${markdownPath})`;
    })
    .join("\n");
};

const renderFindingsSection = (params: {
  title: string;
  findings: AgentFinding[];
  currentFilePath: string;
  outputDir: string;
}) => {
  const { title, findings, currentFilePath, outputDir } = params;

  if (!findings.length) {
    return `## ${title}\n\nNone`;
  }

  const lines: string[] = [`## ${title}`, ""];

  for (const finding of sortFindings(findings)) {
    lines.push(`### [${finding.severity.toUpperCase()}] ${escapeInlineMarkdown(finding.category)} / ${escapeInlineMarkdown(finding.checkName)}`);
    lines.push("");
    lines.push(`- Message: ${escapeInlineMarkdown(finding.message)}`);
    lines.push(`- Explanation: ${escapeInlineMarkdown(finding.explanation)}`);
    lines.push(`- Remediation: ${escapeInlineMarkdown(finding.remediationHint)}`);

    if (finding.expectedReference) {
      lines.push(`- Expected Reference: ${escapeInlineMarkdown(finding.expectedReference)}`);
    }

    if (finding.confidence !== undefined) {
      lines.push(`- Confidence: ${finding.confidence}`);
    }

    lines.push("- Evidence:");
    lines.push("");
    lines.push(renderFindingEvidenceLinks({
      finding,
      currentFilePath,
      outputDir,
    }));
    lines.push("");
  }

  return lines.join("\n").trimEnd();
};

const renderExpectationSection = (entry: TestEntry) => {
  const lines = [
    "## Expectation Comparison",
    "",
    `- Scope Match: ${entry.scope.scopeMatch}`,
    `- Match Reasons: ${entry.scope.reasons.length ? entry.scope.reasons.join(", ") : "None"}`,
    `- Expected References: ${entry.scope.expectedReferences.length ? entry.scope.expectedReferences.join(", ") : "None"}`,
    `- Metadata Mismatches: ${entry.scope.metadataMismatches.length ? entry.scope.metadataMismatches.join("; ") : "None"}`,
  ];

  return lines.join("\n");
};

const renderRerunGuidance = (findings: AgentFinding[]) => {
  const relevant = findings.filter(({ category }) => category === "evidence" || category === "smells" || category === "metadata");

  if (!relevant.length) {
    return undefined;
  }

  const lines = [
    "## Rerun Guidance",
    "",
    "- Add meaningful runtime steps for the important state transitions before rerunning.",
    "- Attach focused logs, payloads, screenshots, or DOM snapshots near the failing point.",
  ];

  if (relevant.some(({ category }) => category === "metadata")) {
    lines.push("- Add or repair the labels and parameters needed to identify the intended scope.");
  }

  if (relevant.some(({ checkName }) => checkName === "noop-dominated-steps")) {
    lines.push("- Replace repetitive event-style steps with a compact text attachment when the signal is mostly logs.");
  }

  lines.push("- Rerun only the relevant tests with the same expectations file so the next review is scoped and comparable.");

  return lines.join("\n");
};

const renderTestFile = (params: {
  entry: TestEntry;
  outputDir: string;
}) => {
  const { entry, outputDir } = params;
  const { tr, environmentId, attempts, allArtifacts } = entry;
  const lines: string[] = [
    "# Test Result",
    "",
    `- Name: ${escapeInlineMarkdown(tr.name)}`,
    `- Full Name: ${escapeInlineMarkdown(tr.fullName ?? tr.name)}`,
    `- Environment: ${escapeInlineMarkdown(environmentId)}`,
    `- History ID: ${escapeInlineMarkdown(tr.historyId ?? "n/a")}`,
    `- Test Result ID: ${escapeInlineMarkdown(tr.id)}`,
    `- Status: ${statusLabel(tr.status)}`,
    `- Duration: ${formatDurationValue(tr.duration)}`,
    `- Started: ${formatTimestamp(tr.start)}`,
    `- Stopped: ${formatTimestamp(tr.stop)}`,
    `- Flaky: ${String(tr.flaky)}`,
    `- Known: ${String(tr.known)}`,
    `- Muted: ${String(tr.muted)}`,
    `- Retries in This Run: ${Math.max(attempts.length - 1, 0)}`,
  ];

  if (tr.titlePath?.length) {
    lines.push(`- Title Path: ${tr.titlePath.map((part) => escapeInlineMarkdown(part)).join(" / ")}`);
  }

  lines.push("");
  lines.push("## Labels");
  lines.push("");
  lines.push(renderLabels(tr.labels));
  lines.push("");
  lines.push("## Parameters");
  lines.push("");
  lines.push(renderParameters(tr.parameters));
  lines.push("");
  lines.push("## Links");
  lines.push("");
  lines.push(renderLinks(tr.links));
  lines.push("");
  lines.push(renderExpectationSection(entry));

  const descriptionSections = [
    renderOptionalMarkdownSection("Description", tr.description),
    renderOptionalMarkdownSection("Precondition", tr.precondition),
    renderOptionalMarkdownSection("Expected Result", tr.expectedResult),
  ].filter(Boolean);

  if (descriptionSections.length) {
    lines.push("");
    lines.push(descriptionSections.join("\n\n"));
  }

  lines.push("");
  lines.push("## Attachments Manifest");
  lines.push("");
  lines.push(allArtifacts.length ? allArtifacts.map((artifact) => renderArtifactLine(artifact, true)).join("\n") : "None");
  lines.push("");
  lines.push(renderFindingsSection({
    title: "Quality Findings",
    findings: entry.findings,
    currentFilePath: entry.filePath,
    outputDir,
  }));
  lines.push("");
  lines.push(...attempts.map((attempt) => renderAttemptSection(attempt)).join("\n\n").split("\n"));

  const rerunGuidance = renderRerunGuidance(entry.findings);

  if (rerunGuidance) {
    lines.push("");
    lines.push(rerunGuidance);
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const renderIndex = (params: {
  context: PluginContext;
  command?: string;
  generatedAt: string;
  phase: RunPhase;
  stats: Statistic;
  durationSummary: { total: number; average: number; max: number };
  environmentSummary: ReturnType<typeof buildEnvironmentSummary>;
  modelingSummary: ModelingSummary;
  expectations?: LoadedExpectations;
  tests: TestEntry[];
  globalArtifacts: MaterializedArtifact[];
  globalErrors: TestError[];
  globalExitCode?: { actual?: number; original: number };
  qualityGateResults: QualityGateValidationResult[];
  findings: AgentFinding[];
}) => {
  const {
    context,
    command,
    generatedAt,
    phase,
    stats,
    durationSummary,
    environmentSummary,
    modelingSummary,
    expectations,
    tests,
    globalArtifacts,
    globalErrors,
    globalExitCode,
    qualityGateResults,
    findings,
  } = params;
  const stdoutArtifact = globalArtifacts.find((artifact) => artifact.displayName === "stdout.txt");
  const stderrArtifact = globalArtifacts.find((artifact) => artifact.displayName === "stderr.txt");
  const remainingGlobalArtifacts = globalArtifacts.filter(
    (artifact) => artifact.displayName !== "stdout.txt" && artifact.displayName !== "stderr.txt",
  );
  const exitCodeSummary =
    globalExitCode?.actual !== undefined && globalExitCode.actual !== globalExitCode.original
      ? `${globalExitCode.actual} (original: ${globalExitCode.original})`
      : globalExitCode
        ? `${globalExitCode.actual ?? globalExitCode.original}`
        : "unknown";
  const checkSummary = buildCheckSummary(findings);
  const needsAttention = sortFindings(findings).filter(({ severity }) => severity !== "info").slice(0, 10);
  const groupedTests = [
    {
      title: "Failed / Broken",
      entries: tests.filter(({ tr }) => tr.status === "failed" || tr.status === "broken"),
    },
    {
      title: "Unknown / Skipped",
      entries: tests.filter(({ tr }) => tr.status === "unknown" || tr.status === "skipped"),
    },
    {
      title: "Passed",
      entries: tests.filter(({ tr }) => tr.status === "passed"),
    },
  ];
  const lines: string[] = [
    `# ${context.reportName}`,
    "",
    "- Format: Allure Agent Markdown",
    `- Generated: ${generatedAt}`,
    `- Report UUID: ${context.reportUuid}`,
    `- Phase: ${phase}`,
    `- Exit Code: ${exitCodeSummary}`,
    `- Command: ${escapeInlineMarkdown(command ?? "unknown")}`,
    "",
    "## Run Summary",
    "",
    `- total: ${stats.total}`,
    `- failed: ${stats.failed ?? 0}`,
    `- broken: ${stats.broken ?? 0}`,
    `- unknown: ${stats.unknown ?? 0}`,
    `- skipped: ${stats.skipped ?? 0}`,
    `- passed: ${stats.passed ?? 0}`,
    `- retries: ${stats.retries ?? 0}`,
    `- flaky: ${stats.flaky ?? 0}`,
    `- total duration: ${formatDurationValue(durationSummary.total)}`,
    `- average duration: ${formatDurationValue(durationSummary.average)}`,
    `- max duration: ${formatDurationValue(durationSummary.max)}`,
  ];

  lines.push("");
  lines.push("## Environment Summary");
  lines.push("");
  lines.push(
    environmentSummary.length
      ? environmentSummary
          .map(
            (environment) =>
              `- ${escapeInlineMarkdown(environment.environmentId)}: ${environment.total} total (${environment.failed} failed, ${environment.broken} broken, ${environment.unknown} unknown, ${environment.skipped} skipped, ${environment.passed} passed)`,
          )
          .join("\n")
      : "None",
  );

  lines.push("");
  lines.push(renderModelingSummary(modelingSummary));

  if (expectations) {
    lines.push("");
    lines.push("## Expected Scope");
    lines.push("");
    lines.push(`- Goal: ${escapeInlineMarkdown(expectations.goal ?? "unknown")}`);
    lines.push(`- Feature / Task: ${escapeInlineMarkdown(expectations.taskId ?? "unknown")}`);
    lines.push(`- Expectations Source: [${escapeInlineMarkdown(expectations.relativePath)}](${normalizeMarkdownPath(expectations.relativePath)})`);
    lines.push(renderSelectorSummary("Expected selectors", expectations.expected));
    lines.push(renderSelectorSummary("Forbidden selectors", expectations.forbidden));

    if (expectations.notes.length) {
      lines.push(`- Notes: ${expectations.notes.map((note) => escapeInlineMarkdown(note)).join(" | ")}`);
    }
  }

  lines.push("");
  lines.push("## Advisory Check Summary");
  lines.push("");
  lines.push(`- modeling completeness: ${modelingSummary.completeness}`);
  lines.push(`- total findings: ${checkSummary.total}`);
  lines.push(`- high: ${checkSummary.countsBySeverity.high}`);
  lines.push(`- warning: ${checkSummary.countsBySeverity.warning}`);
  lines.push(`- info: ${checkSummary.countsBySeverity.info}`);
  lines.push(`- bootstrap: ${checkSummary.countsByCategory.bootstrap}`);
  lines.push(`- scope: ${checkSummary.countsByCategory.scope}`);
  lines.push(`- metadata: ${checkSummary.countsByCategory.metadata}`);
  lines.push(`- evidence: ${checkSummary.countsByCategory.evidence}`);
  lines.push(`- smells: ${checkSummary.countsByCategory.smells}`);

  lines.push("");
  lines.push("## Needs Attention First");
  lines.push("");

  if (!needsAttention.length) {
    lines.push("None");
  } else {
    lines.push(
      needsAttention
        .map((finding) => {
          const target =
            finding.subjectType === "test"
              ? tests.find((entry) => entry.key === finding.subject)
              : undefined;
          const targetLink = target ? ` ([test](${normalizeMarkdownPath(target.relativePath)}))` : "";

          return `- [${finding.severity.toUpperCase()}] ${escapeInlineMarkdown(finding.message)}${targetLink}`;
        })
        .join("\n"),
    );
  }

  if (stdoutArtifact?.relativePath || stderrArtifact?.relativePath) {
    lines.push("");
    lines.push("## Process Logs");
    lines.push("");

    if (stdoutArtifact) {
      lines.push(renderArtifactLine(stdoutArtifact, false));
    }

    if (stderrArtifact) {
      lines.push(renderArtifactLine(stderrArtifact, false));
    }
  }

  const qualityGateSection = renderQualityGateSection(qualityGateResults);

  if (qualityGateSection) {
    lines.push("");
    lines.push(qualityGateSection);
  }

  if (remainingGlobalArtifacts.length > 0) {
    lines.push("");
    lines.push("## Global Artifacts");
    lines.push("");
    lines.push(remainingGlobalArtifacts.map((artifact) => renderArtifactLine(artifact, false)).join("\n"));
  }

  const globalErrorsSection = renderGlobalErrors(globalErrors);

  if (globalErrorsSection) {
    lines.push("");
    lines.push(globalErrorsSection);
  }

  for (const group of groupedTests) {
    lines.push("");
    lines.push(`## ${group.title}`);
    lines.push("");

    if (!group.entries.length) {
      lines.push("None");
      continue;
    }

    lines.push(
      group.entries
        .map((entry) => {
          const counts = toFindingCounts(entry.findings);

          return `- [${escapeInlineMarkdown(entry.tr.fullName ?? entry.tr.name)}](${normalizeMarkdownPath(entry.relativePath)}) | status: ${statusLabel(entry.tr.status)} | env: ${escapeInlineMarkdown(entry.environmentId)} | duration: ${formatDurationValue(entry.tr.duration)} | retries: ${Math.max(entry.attempts.length - 1, 0)} | scope: ${entry.scope.scopeMatch} | findings: ${counts.total}`;
        })
        .join("\n"),
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const collectAttachmentReferences = (steps: TestStepResult[], source: string): AttachmentReference[] => {
  const result: AttachmentReference[] = [];

  for (const step of steps) {
    if (isAttachment(step)) {
      result.push({
        link: step.link,
        source,
      });

      continue;
    }

    if (isStep(step) && step.steps.length) {
      result.push(...collectAttachmentReferences(step.steps, source));
    }
  }

  return result;
};

const buildCandidateFileName = (
  link: AttachmentLink,
  fallbackId: string,
  preferName: boolean,
  usedNames: Set<string>,
) => {
  const preferredName = preferName ? attachmentName(link) ?? link.originalFileName : link.originalFileName ?? attachmentName(link);
  const rawName = basename(preferredName ?? `${fallbackId}${link.ext ?? ""}`);
  const safeName = sanitizePathSegment(rawName, `${fallbackId}${link.ext ?? ""}`);

  if (!usedNames.has(safeName)) {
    usedNames.add(safeName);
    return safeName;
  }

  const extension = extname(safeName) || link.ext || "";
  const baseName = extension ? safeName.slice(0, -extension.length) : safeName;
  let counter = 0;
  let candidate = sanitizePathSegment(`${baseName}--${fallbackId}${extension}`, `${fallbackId}${extension}`);

  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = sanitizePathSegment(`${baseName}--${fallbackId}-${counter}${extension}`, `${fallbackId}-${counter}${extension}`);
  }

  usedNames.add(candidate);

  return candidate;
};

const materializeArtifacts = async (params: {
  references: AttachmentReference[];
  artifactDir: string;
  filePath: string;
  preferName: boolean;
  resolveContent: (id: string) => Promise<ResultFile | undefined>;
  copiedById: Map<string, MaterializedArtifact>;
  usedNames: Set<string>;
}) => {
  const { references, artifactDir, filePath, preferName, resolveContent, copiedById, usedNames } = params;
  const refsById = new Map<string, AttachmentReference>();

  for (const reference of references) {
    const current = refsById.get(reference.link.id);

    if (current) {
      current.source = `${current.source}; ${reference.source}`;
      continue;
    }

    refsById.set(reference.link.id, { ...reference });
  }

  const artifacts: MaterializedArtifact[] = [];

  for (const { link, source } of refsById.values()) {
    const sources = uniqueValues(source.split("; ").filter(Boolean));
    const existing = copiedById.get(link.id);

    if (existing) {
      existing.sources = uniqueValues(existing.sources.concat(sources));
      artifacts.push(existing);
      continue;
    }

    const artifact: MaterializedArtifact = {
      id: link.id,
      displayName: attachmentDisplayName(link),
      sources,
      contentType: link.contentType,
      missing: true,
    };

    if (!link.missed) {
      const content = await resolveContent(link.id);

      if (content) {
        const fileName = buildCandidateFileName(link, sanitizePathSegment(link.id, "artifact"), preferName, usedNames);
        const targetPath = join(artifactDir, fileName);

        await mkdir(dirname(targetPath), { recursive: true });
        await content.writeTo(targetPath);

        artifact.relativePath = normalizeMarkdownPath(relative(dirname(filePath), targetPath));
        artifact.contentType = content.getContentType() ?? link.contentType;
        artifact.contentLength = content.getContentLength();
        artifact.missing = false;
      }
    }

    copiedById.set(link.id, artifact);
    artifacts.push(artifact);
  }

  return artifacts;
};

const buildAttemptArtifacts = async (params: {
  heading: string;
  tr: TestResult;
  fixtures: TestFixtureResult[];
  store: AllureStore;
  artifactDir: string;
  filePath: string;
  copiedById: Map<string, MaterializedArtifact>;
  usedNames: Set<string>;
}) => {
  const { heading, tr, fixtures, store, artifactDir, filePath, copiedById, usedNames } = params;
  const references: AttachmentReference[] = (await store.attachmentsByTrId(tr.id)).map((link) => ({
    link,
    source: `${heading}: test result`,
  }));

  references.push(...collectAttachmentReferences(tr.steps, `${heading}: test steps`));

  for (const fixture of fixtures) {
    references.push(
      ...collectAttachmentReferences(
        fixture.steps,
        `${heading}: ${fixture.type === "before" ? "before" : "after"} fixture ${fixture.name}`,
      ),
    );
  }

  return materializeArtifacts({
    references,
    artifactDir,
    filePath,
    preferName: false,
    resolveContent: (id) => store.attachmentContentById(id),
    copiedById,
    usedNames,
  });
};

const buildGlobalArtifacts = async (outputDir: string, store: AllureStore) => {
  const globalArtifactsDir = join(outputDir, "artifacts", "global");
  const usedNames = new Set<string>();
  const copiedById = new Map<string, MaterializedArtifact>();
  const references = (await store.allGlobalAttachments()).map((link) => ({
    link,
    source: "global attachment",
  }));

  return materializeArtifacts({
    references,
    artifactDir: globalArtifactsDir,
    filePath: join(outputDir, "index.md"),
    preferName: true,
    resolveContent: (id) => store.attachmentContentById(id),
    copiedById,
    usedNames,
  });
};

const readMaterializedArtifactText = async (outputDir: string, artifact?: MaterializedArtifact) => {
  if (!artifact?.relativePath) {
    return undefined;
  }

  try {
    return await readFile(join(outputDir, artifact.relativePath), "utf-8");
  } catch {
    return undefined;
  }
};

const resolveOutputDir = (options: AgentPluginOptions) => {
  const outputDir = options.outputDir ?? env[AGENT_OUTPUT_ENV];

  return outputDir ? resolve(outputDir) : undefined;
};

const cleanupManagedEntries = async (outputDir: string) => {
  await Promise.all(
    MANAGED_ENTRIES.map(async (entry) => {
      await rm(join(outputDir, entry), {
        recursive: true,
        force: true,
      });
    }),
  );
};

const createUniqueSlug = (slug: string, trId: string, usedSlugs: Set<string>) => {
  if (!usedSlugs.has(slug)) {
    usedSlugs.add(slug);
    return {
      slug,
      collision: false,
    };
  }

  let candidate = `${slug}--${sanitizePathSegment(trId, "tr")}`;
  let counter = 0;

  while (usedSlugs.has(candidate)) {
    counter += 1;
    candidate = `${slug}--${sanitizePathSegment(trId, "tr")}-${counter}`;
  }

  usedSlugs.add(candidate);

  return {
    slug: candidate,
    collision: true,
  };
};

const createFindingFactory = () => {
  let sequence = 0;

  return (finding: Omit<AgentFinding, "findingId">): AgentFinding => {
    sequence += 1;

    return {
      findingId: `F${sequence.toString().padStart(4, "0")}`,
      ...finding,
    };
  };
};

const parseExpectations = (rawContent: string) => {
  const parsed = parse(rawContent) as ExpectationsInput;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a YAML or JSON object");
  }

  return parsed;
};

const loadExpectations = async (
  outputDir: string,
  createFinding: ReturnType<typeof createFindingFactory>,
) => {
  const configuredPath = env[AGENT_EXPECTATIONS_ENV];

  if (!configuredPath) {
    return {
      expectations: undefined,
      findings: [] as AgentFinding[],
    };
  }

  const expectationsPath = resolve(configuredPath);

  try {
    const rawContent = await readFile(expectationsPath, "utf-8");
    const parsed = parseExpectations(rawContent);

    const relativePath = normalizeMarkdownPath("manifest/expected.json");

    await mkdir(join(outputDir, "manifest"), { recursive: true });
    await writeFile(join(outputDir, relativePath), `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");

    return {
      expectations: {
        sourcePath: expectationsPath,
        relativePath,
        raw: parsed,
        goal: parsed.goal,
        taskId: parsed.task_id,
        notes: normalizeNotes(parsed.notes),
        expected: normalizeSelectors(parsed.expected),
        forbidden: normalizeSelectors(parsed.forbidden),
      } satisfies LoadedExpectations,
      findings: [] as AgentFinding[],
    };
  } catch (error) {
    return {
      expectations: undefined,
      findings: [
        createFinding({
          subject: "run",
          subjectType: "run",
          severity: "high",
          category: "bootstrap",
          checkName: "invalid-expectations-file",
          message: `Could not load ALLURE_AGENT_EXPECTATIONS from ${expectationsPath}`,
          explanation: `The expectations file could not be parsed as YAML or JSON: ${(error as Error).message}`,
          evidencePaths: [],
          remediationHint: "Provide a readable YAML or JSON file in ALLURE_AGENT_EXPECTATIONS before rerunning.",
          expectedReference: undefined,
        }),
      ],
    };
  }
};

const loadProjectGuide = async (outputDir: string): Promise<LoadedProjectGuide | undefined> => {
  const projectRoot = resolve(env[AGENT_PROJECT_ROOT_ENV] ?? process.cwd());
  const sourcePath = join(projectRoot, "docs", "allure-agent-mode.md");

  try {
    const content = await readFile(sourcePath, "utf-8");
    const relativePath = normalizeMarkdownPath(join("project", "docs", "allure-agent-mode.md"));

    await mkdir(join(outputDir, "project", "docs"), { recursive: true });
    await writeFile(join(outputDir, relativePath), content, "utf-8");

    return {
      sourcePath,
      relativePath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
};

const computeScopeEvaluation = (params: {
  tr: TestResult;
  environmentId: string;
  expectations?: LoadedExpectations;
}) => {
  const { tr, environmentId, expectations } = params;

  if (!expectations) {
    return {
      scopeMatch: "unknown",
      reasons: [],
      expectedReferences: [],
      metadataMismatches: [],
    } satisfies ScopeEvaluation;
  }

  const positivePresent = hasSelector(expectations.expected);
  const positive = matchSelectors({
    tr,
    environmentId,
    selectors: expectations.expected,
    selectorRoot: "expected",
  });
  const forbidden = matchSelectors({
    tr,
    environmentId,
    selectors: expectations.forbidden,
    selectorRoot: "forbidden",
  });
  const metadataMismatches =
    positive.matchedByNonLabel && Object.keys(expectations.expected.labelValues).length > 0 && !positive.labelMatch
      ? collectMissingLabelSelectors(tr.labels, expectations.expected.labelValues)
      : [];

  if (forbidden.matched) {
    return {
      scopeMatch: "forbidden",
      reasons: forbidden.reasons,
      expectedReferences: forbidden.references,
      metadataMismatches,
    } satisfies ScopeEvaluation;
  }

  if (!positivePresent) {
    return {
      scopeMatch: "unknown",
      reasons: [],
      expectedReferences: [],
      metadataMismatches,
    } satisfies ScopeEvaluation;
  }

  if (positive.matched) {
    return {
      scopeMatch: "match",
      reasons: positive.reasons,
      expectedReferences: positive.references,
      metadataMismatches,
    } satisfies ScopeEvaluation;
  }

  return {
    scopeMatch: "unexpected",
    reasons: [],
    expectedReferences: [],
    metadataMismatches,
  } satisfies ScopeEvaluation;
};

const buildDurationSummary = (entries: TestEntry[]) => {
  const durations = entries.map(({ tr }) => tr.duration ?? 0);
  const total = durations.reduce((acc, value) => acc + value, 0);

  return {
    total,
    average: durations.length ? Math.round(total / durations.length) : 0,
    max: durations.length ? Math.max(...durations) : 0,
  };
};

const collectTestEvidencePaths = (entry: TestEntry) => {
  const paths = [entry.relativePath];

  for (const artifact of entry.allArtifacts) {
    if (artifact.relativePath) {
      paths.push(artifact.relativePath);
    }
  }

  return uniqueValues(paths);
};

const buildRunAndTestFindings = (params: {
  entries: TestEntry[];
  expectations?: LoadedExpectations;
  globalArtifacts: MaterializedArtifact[];
  modelingSummary: ModelingSummary;
  createFinding: ReturnType<typeof createFindingFactory>;
}) => {
  const { entries, expectations, globalArtifacts, modelingSummary, createFinding } = params;
  const runFindings: AgentFinding[] = [];
  const stdoutArtifact = globalArtifacts.find((artifact) => artifact.displayName === "stdout.txt");
  const stderrArtifact = globalArtifacts.find((artifact) => artifact.displayName === "stderr.txt");

  if (entries.length === 0) {
    runFindings.push(
      createFinding({
        subject: "run",
        subjectType: "run",
        severity: "high",
        category: "bootstrap",
        checkName: "no-visible-tests",
        message: "No visible test results were found in the run.",
        explanation: "The agent output was generated, but there were no visible logical test results to review.",
        evidencePaths: [],
        remediationHint: "Verify that Allure results are being generated and that the test command actually executed the intended tests.",
      }),
    );
  }

  if (!stdoutArtifact && !stderrArtifact) {
    runFindings.push(
      createFinding({
        subject: "run",
        subjectType: "run",
        severity: "info",
        category: "bootstrap",
        checkName: "missing-global-logs",
        message: "The run does not include global stdout or stderr logs.",
        explanation: "Global process logs help agents debug bootstrap failures and compare the recorded results with console output.",
        evidencePaths: [],
        remediationHint: "Run tests through `allure run -- <command>` without disabling log capture when you need bootstrap diagnostics.",
        confidence: 0.9,
      }),
    );
  }

  if (modelingSummary.runnerFailures.total > 0) {
    runFindings.push(
      createFinding({
        subject: "run",
        subjectType: "run",
        severity: "high",
        category: "bootstrap",
        checkName: "runner-failures-outside-logical-results",
        message: "Runner-level failures were detected outside logical test results.",
        explanation:
          "Global errors or high-signal stderr messages suggest suite-load, import, or setup failures that are not represented in `manifest/tests.jsonl`.",
        evidencePaths: stderrArtifact?.relativePath ? [stderrArtifact.relativePath] : [],
        remediationHint: "Inspect global stderr and global errors before accepting the run, then rerun once the missing failures are understood.",
        confidence: 0.92,
      }),
    );
  }

  if (modelingSummary.unmodeledFromStats.total > 0) {
    const severity: FindingSeverity =
      modelingSummary.unmodeledFromStats.failed > 0 ||
      modelingSummary.unmodeledFromStats.broken > 0 ||
      modelingSummary.unmodeledFromStats.unknown > 0
        ? "warning"
        : "info";

    runFindings.push(
      createFinding({
        subject: "run",
        subjectType: "run",
        severity,
        category: "bootstrap",
        checkName: "unmodeled-visible-results",
        message: "The run summary includes visible results that were not rendered as logical test files.",
        explanation: `The store statistics reported ${modelingSummary.compact.visible_results} visible results, but agent mode rendered only ${modelingSummary.compact.logical_tests} logical test files. Missing counts: ${summarizeStatusCounts(modelingSummary.unmodeledFromStats)}.`,
        evidencePaths: stderrArtifact?.relativePath ? [stderrArtifact.relativePath] : [],
        remediationHint: "Treat the run as partially modeled, inspect the global logs, and call out any missing skipped or failing results before final review.",
        confidence: 0.8,
      }),
    );
  }

  const actualEnvironments = uniqueValues(entries.map(({ environmentId }) => environmentId));

  if (expectations) {
    const allFullNames = entries.map(({ tr }) => tr.fullName ?? tr.name);

    expectations.expected.fullNames.forEach((fullName, index) => {
      if (!allFullNames.includes(fullName)) {
        runFindings.push(
          createFinding({
            subject: "run",
            subjectType: "run",
            severity: "high",
            category: "scope",
            checkName: "missing-expected-test",
            message: `Expected test did not run: ${fullName}`,
            explanation: "The expectations file explicitly listed this test, but it did not appear in the agentic output.",
            evidencePaths: expectations.relativePath ? [expectations.relativePath] : [],
            remediationHint: "Check the test selection, environment, and feature branch scope before rerunning.",
            expectedReference: `expected.full_names[${index}]`,
          }),
        );
      }
    });

    expectations.expected.fullNamePrefixes.forEach((prefix, index) => {
      if (!allFullNames.some((fullName) => fullName.startsWith(prefix))) {
        runFindings.push(
          createFinding({
            subject: "run",
            subjectType: "run",
            severity: "warning",
            category: "scope",
            checkName: "missing-expected-prefix",
            message: `No executed test matched the expected prefix: ${prefix}`,
            explanation: "The expectations file asked for tests within this name prefix, but none were recorded.",
            evidencePaths: expectations.relativePath ? [expectations.relativePath] : [],
            remediationHint: "Check the expected selector or adjust the executed test target so the intended scope is covered.",
            expectedReference: `expected.full_name_prefixes[${index}]`,
          }),
        );
      }
    });

    expectations.expected.environments.forEach((environment, index) => {
      if (!actualEnvironments.includes(environment)) {
        runFindings.push(
          createFinding({
            subject: "run",
            subjectType: "run",
            severity: "warning",
            category: "scope",
            checkName: "missing-expected-environment",
            message: `Expected environment did not appear in the run: ${environment}`,
            explanation: "The expectations file scoped the run to this environment, but no logical test result matched it.",
            evidencePaths: expectations.relativePath ? [expectations.relativePath] : [],
            remediationHint: "Check the environment selector or rerun the intended environment explicitly.",
            expectedReference: `expected.environments[${index}]`,
          }),
        );
      }
    });

    Object.entries(expectations.expected.labelValues).forEach(([labelName, values]) => {
      const matched = entries.some(({ tr }) => matchesLabelSelectors(tr.labels, { [labelName]: values }));

      if (!matched) {
        runFindings.push(
          createFinding({
            subject: "run",
            subjectType: "run",
            severity: "warning",
            category: "scope",
            checkName: "missing-expected-label-selector",
            message: `No executed test matched ${formatLabelRequirement(labelName, values)}`,
            explanation: "The expectations file defined a label selector for the intended scope, but no logical test result satisfied it.",
            evidencePaths: expectations.relativePath ? [expectations.relativePath] : [],
            remediationHint: "Add the expected label metadata to the intended tests or adjust the expectations selector.",
            expectedReference: `expected.label_values/${escapeJsonPointerSegment(labelName)}`,
          }),
        );
      }
    });

    if (expectations.expected.environments.length > 0) {
      actualEnvironments
        .filter((environment) => !expectations.expected.environments.includes(environment))
        .forEach((environment) => {
          runFindings.push(
            createFinding({
              subject: "run",
              subjectType: "run",
              severity: "warning",
              category: "scope",
              checkName: "unexpected-environment",
              message: `Unexpected environment ran: ${environment}`,
              explanation: "The run included an environment outside the expected scope.",
              evidencePaths: [],
              remediationHint: "Narrow the environment selector or remove unrelated results before rerunning.",
              confidence: 0.95,
            }),
          );
        });
    }
  }

  for (const entry of entries) {
    const currentAttempt = entry.attempts[0];
    const attemptSignatures = uniqueValues(entry.attempts.map(buildAttemptSignature));
    const testEvidencePaths = collectTestEvidencePaths(entry);
    const allStepSummary = mergeStepSummaries(entry.attempts.map((attempt) => mergeStepSummaries([attempt.stepSummary, attempt.fixtureStepSummary])));
    const hasUsefulSteps = currentAttempt.stepSummary.meaningfulSteps + currentAttempt.fixtureStepSummary.meaningfulSteps > 0;
    const hasAnyAttachments = entry.allArtifacts.some((artifact) => !artifact.missing);
    const noopRatio = allStepSummary.totalSteps > 0 ? allStepSummary.noopSteps / allStepSummary.totalSteps : 0;

    if (entry.scope.scopeMatch === "forbidden") {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "high",
          category: "scope",
          checkName: "forbidden-selector-match",
          message: "This test matched a forbidden selector from the expectations file.",
          explanation: "The logical test belongs to a scope that the expectations file explicitly marked as forbidden.",
          evidencePaths: expectations?.relativePath ? [entry.relativePath, expectations.relativePath] : [entry.relativePath],
          remediationHint: "Tighten the test selection or update the expectations file before accepting the run.",
          expectedReference: entry.scope.expectedReferences[0],
        }),
      );
    } else if (entry.scope.scopeMatch === "unexpected") {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "scope",
          checkName: "unexpected-test",
          message: "This test ran outside the expected scope.",
          explanation: "The expectations file defined positive scope selectors, but this logical test did not match any of them.",
          evidencePaths: expectations?.relativePath ? [entry.relativePath, expectations.relativePath] : [entry.relativePath],
          remediationHint: "Rerun only the intended tests or broaden the expectations file if this test is part of the plan.",
        }),
      );
    }

    if (entry.scope.metadataMismatches.length > 0) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "metadata",
          checkName: "metadata-mismatch",
          message: "Test metadata does not fully match the expected label selectors.",
          explanation: entry.scope.metadataMismatches.join("; "),
          evidencePaths: expectations?.relativePath ? [entry.relativePath, expectations.relativePath] : [entry.relativePath],
          remediationHint: "Add or repair the labels that identify the intended feature, task, or environment.",
          expectedReference: entry.scope.expectedReferences.find((reference) => reference.startsWith("expected.label_values")),
          confidence: 0.9,
        }),
      );
    }

    if (entry.historyCollision) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "metadata",
          checkName: "history-id-collision",
          message: "Multiple visible tests shared the same history ID in this environment.",
          explanation: "The output had to suffix the markdown file name because the logical test key was not unique within the environment.",
          evidencePaths: [entry.relativePath],
          remediationHint: "Ensure the test metadata produces unique history IDs for distinct logical tests.",
          confidence: 0.85,
        }),
      );
    }

    if (isFailedLikeStatus(currentAttempt.tr.status) && !hasUsefulSteps) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "evidence",
          checkName: "failed-without-useful-steps",
          message: "A failed or broken test has no useful runtime steps.",
          explanation: "The failure is recorded, but the step tree does not explain the state transitions that led to it.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Add meaningful steps around the important actions and checks before rerunning.",
          confidence: 0.92,
        }),
      );
    }

    if (isFailedLikeStatus(currentAttempt.tr.status) && !hasAnyAttachments) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "evidence",
          checkName: "failed-without-attachments",
          message: "A failed or broken test has no test-scoped attachments.",
          explanation: "Attachments often provide the fastest route to understanding why the test failed.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Attach targeted logs, payloads, screenshots, or DOM snapshots around the failing point.",
          confidence: 0.88,
        }),
      );
    }

    if (
      (currentAttempt.tr.duration ?? 0) >= NONTRIVIAL_DURATION_MS &&
      currentAttempt.stepSummary.totalSteps === 0 &&
      currentAttempt.fixtureStepSummary.totalSteps === 0
    ) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "evidence",
          checkName: "nontrivial-run-with-empty-trace",
          message: "A nontrivial test run recorded no steps or fixture activity.",
          explanation: "The duration suggests real work happened, but the trace contains no step-level evidence.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Add runtime steps or attachments so the execution path is observable on the next run.",
          confidence: 0.8,
        }),
      );
    }

    if (entry.attempts.length > 1 && attemptSignatures.length === 1) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "info",
          category: "evidence",
          checkName: "retries-without-new-evidence",
          message: "Retries did not add any new observable evidence.",
          explanation: "The recorded status, error, steps, and attachments stayed effectively unchanged across retries.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Add retry-specific diagnostics or targeted attachments so reruns can show what changed.",
          confidence: 0.7,
        }),
      );
    }

    if (allStepSummary.totalSteps >= 3 && noopRatio >= NOOP_RATIO_THRESHOLD && !hasAnyAttachments) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "warning",
          category: "smells",
          checkName: "noop-dominated-steps",
          message: "The step tree is dominated by low-signal steps.",
          explanation: "Most recorded steps are leaf steps without parameters, nested actions, attachments, or error context.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Collapse repetitive event-style steps into a smaller set of meaningful steps or attach a text log instead.",
          confidence: 0.75,
        }),
      );
    }

    if (allStepSummary.totalSteps >= STEP_SPAM_THRESHOLD && !hasAnyAttachments) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "info",
          category: "smells",
          checkName: "step-spam",
          message: "The trace records many steps but no compact artifact.",
          explanation: "A large number of small steps can be harder to review than a focused log attachment.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Consider attaching a structured text log when the trace is mostly event reporting.",
          confidence: 0.7,
        }),
      );
    }

    if (isFailedLikeStatus(currentAttempt.tr.status) && !hasAnyAttachments && globalArtifacts.length > 0) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "info",
          category: "smells",
          checkName: "global-only-artifacts",
          message: "Only run-level artifacts are available for this failed test.",
          explanation: "The run captured global logs, but the failed test has no test-scoped attachments to pinpoint the failure.",
          evidencePaths: uniqueValues(testEvidencePaths.concat(globalArtifacts.flatMap((artifact) => (artifact.relativePath ? [artifact.relativePath] : [])))),
          remediationHint: "Prefer step-scoped or test-scoped attachments near the failing action when debugging targeted failures.",
          confidence: 0.78,
        }),
      );
    }

    if (
      currentAttempt.tr.status === "passed" &&
      (currentAttempt.tr.duration ?? 0) >= NONTRIVIAL_DURATION_MS &&
      currentAttempt.stepSummary.totalSteps === 0 &&
      currentAttempt.fixtureStepSummary.totalSteps === 0 &&
      !hasAnyAttachments
    ) {
      entry.findings.push(
        createFinding({
          subject: entry.key,
          subjectType: "test",
          severity: "info",
          category: "smells",
          checkName: "passed-without-observable-evidence",
          message: "A nontrivial passing test recorded no observable evidence.",
          explanation: "The test passed, but the agentic output contains no steps, fixture activity, or attachments showing what was verified.",
          evidencePaths: testEvidencePaths,
          remediationHint: "Add a few meaningful verification steps or attachments so the success path is reviewable.",
          confidence: 0.65,
        }),
      );
    }
  }

  return {
    runFindings,
    allFindings: sortFindings(runFindings.concat(entries.flatMap((entry) => entry.findings))),
  };
};

const listVisibleTestLayouts = async (params: {
  outputDir: string;
  store: AllureStore;
}) => {
  const { outputDir, store } = params;
  const tests = (await store.allTestResults({ includeHidden: false })).sort(compareTestResultsByStatusThenName);
  const layouts: TestEntryLayout[] = [];
  const slugsByEnvironment = new Map<string, Set<string>>();

  for (const tr of tests) {
    const rawEnvironmentId = (await store.environmentIdByTrId(tr.id)) ?? "default";
    const environmentId = rawEnvironmentId;
    const environmentPath = sanitizePathSegment(rawEnvironmentId, "default");
    const slugSeed = sanitizePathSegment(tr.historyId ?? tr.id, sanitizePathSegment(tr.id, "test"));
    const usedSlugs = slugsByEnvironment.get(environmentPath) ?? new Set<string>();

    slugsByEnvironment.set(environmentPath, usedSlugs);

    const slugResult = createUniqueSlug(slugSeed, tr.id, usedSlugs);
    const slug = slugResult.slug;
    const filePath = join(outputDir, "tests", environmentPath, `${slug}.md`);
    const relativePath = normalizeMarkdownPath(relative(outputDir, filePath));
    const assetDir = join(outputDir, "tests", environmentPath, `${slug}.assets`);
    const relativeAssetDir = normalizeMarkdownPath(relative(outputDir, assetDir));
    layouts.push({
      tr,
      environmentId,
      environmentPath,
      slug,
      relativePath,
      filePath,
      assetDir,
      relativeAssetDir,
      historyCollision: slugResult.collision,
    });
  }

  return layouts;
};

const buildEntryFromLayout = async (params: {
  layout: TestEntryLayout;
  store: AllureStore;
  expectations?: LoadedExpectations;
}) => {
  const { layout, store, expectations } = params;
  const { tr, environmentId, environmentPath, slug, relativePath, filePath, assetDir, relativeAssetDir, historyCollision } = layout;
  const retries = sortByNewestAttempt(await store.retriesByTr(tr));
  const attemptsToRender = [tr, ...retries];
  const attempts: AttemptRecord[] = [];
  const copiedById = new Map<string, MaterializedArtifact>();
  const usedNames = new Set<string>();

  for (const [index, attemptTr] of attemptsToRender.entries()) {
    const heading = index === 0 ? "Current Attempt" : `Retry ${index}`;
    const fixtures = await store.fixturesByTrId(attemptTr.id);
    const artifacts = await buildAttemptArtifacts({
      heading,
      tr: attemptTr,
      fixtures,
      store,
      artifactDir: assetDir,
      filePath,
      copiedById,
      usedNames,
    });

    attempts.push({
      heading,
      tr: attemptTr,
      fixtures,
      artifacts,
      stepSummary: analyzeStepTree(attemptTr.steps),
      fixtureStepSummary: mergeStepSummaries(fixtures.map((fixture) => analyzeStepTree(fixture.steps))),
    });
  }

  const allArtifacts = Array.from(copiedById.values()).sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    key: relativePath,
    tr,
    environmentId,
    environmentPath,
    slug,
    relativePath,
    filePath,
    relativeAssetDir,
    attempts,
    allArtifacts,
    findings: [],
    scope: computeScopeEvaluation({
      tr,
      environmentId,
      expectations,
    }),
    packageName: getPackageName(tr),
    historyCollision,
  } satisfies TestEntry;
};

const buildEntries = async (params: {
  outputDir: string;
  store: AllureStore;
  expectations?: LoadedExpectations;
}) => {
  const { outputDir, store, expectations } = params;
  const layouts = await listVisibleTestLayouts({
    outputDir,
    store,
  });

  const entries: TestEntry[] = [];

  for (const layout of layouts) {
    entries.push(
      await buildEntryFromLayout({
        layout,
        store,
        expectations,
      }),
    );
  }

  return entries;
};

const buildSnapshot = async (params: {
  outputDir: string;
  store: AllureStore;
  expectations?: LoadedExpectations;
  expectationLoadFindings: AgentFinding[];
  createFinding: ReturnType<typeof createFindingFactory>;
}) => {
  const { outputDir, store, expectations, expectationLoadFindings, createFinding } = params;
  const stats = await store.testsStatistic((testResult) => !testResult.hidden);
  const entries = await buildEntries({
    outputDir,
    store,
    expectations,
  });
  const globalArtifacts = await buildGlobalArtifacts(outputDir, store);
  const globalErrors = await store.allGlobalErrors();
  const globalExitCode = await store.globalExitCode();
  const qualityGateResults = await store.qualityGateResults();
  const stderrArtifact = globalArtifacts.find((artifact) => artifact.displayName === "stderr.txt");
  const stderrContent = await readMaterializedArtifactText(outputDir, stderrArtifact);
  const modelingSummary = buildModelingSummary({
    entries,
    stats,
    globalErrors,
    stderrContent,
  });
  const { runFindings } = buildRunAndTestFindings({
    entries,
    expectations,
    globalArtifacts,
    modelingSummary,
    createFinding,
  });
  const combinedRunFindings = sortFindings(expectationLoadFindings.concat(runFindings));
  const combinedAllFindings = sortFindings(combinedRunFindings.concat(entries.flatMap((entry) => entry.findings)));

  return {
    stats,
    entries,
    globalArtifacts,
    globalErrors,
    globalExitCode,
    qualityGateResults,
    modelingSummary,
    durationSummary: buildDurationSummary(entries),
    combinedRunFindings,
    combinedAllFindings,
  } satisfies AgentSnapshot;
};

const temporaryWritePath = (path: string) => `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const writeTextAtomic = async (path: string, value: string) => {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = temporaryWritePath(path);

  await writeFile(tempPath, value, "utf-8");
  await rename(tempPath, path);
};

const writeJson = async (path: string, value: unknown) => {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
};

const writeJsonlSnapshot = async (path: string, items: unknown[]) => {
  const content = items.map((item) => JSON.stringify(item)).join("\n");

  await writeTextAtomic(path, content.length ? `${content}\n` : "");
};

const initializeJsonlStream = async (path: string) => {
  await writeTextAtomic(path, "");
};

const appendJsonlLine = async (path: string, item: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(item)}\n`, "utf-8");
};

const toRunManifest = (params: {
  context: PluginContext;
  command?: string;
  generatedAt: string;
  phase: RunPhase;
  expectations?: LoadedExpectations;
  projectGuide?: LoadedProjectGuide;
  snapshot: AgentSnapshot;
}) => {
  const { context, command, generatedAt, phase, expectations, projectGuide, snapshot } = params;
  const stdoutArtifact = snapshot.globalArtifacts.find((artifact) => artifact.displayName === "stdout.txt");
  const stderrArtifact = snapshot.globalArtifacts.find((artifact) => artifact.displayName === "stderr.txt");
  const originalExitCode = snapshot.globalExitCode?.original ?? null;
  const actualExitCode = snapshot.globalExitCode?.actual ?? snapshot.globalExitCode?.original ?? null;

  return {
    schema_version: AGENT_SCHEMA_VERSION,
    report_uuid: context.reportUuid,
    generated_at: generatedAt,
    phase,
    command: command ?? null,
    actual_exit_code: actualExitCode,
    original_exit_code: originalExitCode,
    exit_code: snapshot.globalExitCode
      ? {
          original: snapshot.globalExitCode.original,
          actual: snapshot.globalExitCode.actual ?? null,
        }
      : null,
    summary: {
      stats: snapshot.stats,
      modeled_stats: snapshot.modelingSummary.modeledStats,
      unmodeled_from_stats: snapshot.modelingSummary.unmodeledFromStats,
      compact: {
        ...snapshot.modelingSummary.compact,
        findings: snapshot.combinedAllFindings.length,
      },
      duration_ms: snapshot.durationSummary,
      environments: buildEnvironmentSummary(snapshot.entries),
    },
    modeling: snapshot.modelingSummary,
    paths: {
      index_md: "index.md",
      agents_md: "AGENTS.md",
      tests_manifest: "manifest/tests.jsonl",
      findings_manifest: "manifest/findings.jsonl",
      test_events_manifest: "manifest/test-events.jsonl",
      expected_manifest: expectations?.relativePath ?? null,
      project_guide: projectGuide?.relativePath ?? null,
      process_logs: {
        stdout: stdoutArtifact?.relativePath ?? null,
        stderr: stderrArtifact?.relativePath ?? null,
      },
    },
    expectations_present: Boolean(expectations),
    check_summary: buildCheckSummary(snapshot.combinedAllFindings),
    agent_context: {
      agent_name: env[AGENT_NAME_ENV] ?? null,
      loop_id: env[AGENT_LOOP_ID_ENV] ?? null,
      task_id: env[AGENT_TASK_ID_ENV] ?? expectations?.taskId ?? null,
      conversation_id: env[AGENT_CONVERSATION_ID_ENV] ?? null,
    },
  };
};

const writeSnapshotFiles = async (params: {
  runtime: AgentRuntimeState;
  snapshot: AgentSnapshot;
  phase: RunPhase;
}) => {
  const { runtime, snapshot, phase } = params;
  const { outputDir, context, command, generatedAt, expectations, projectGuide } = runtime;
  const nextTestPaths = new Set(snapshot.entries.map((entry) => entry.filePath));
  const nextAssetDirs = new Set(snapshot.entries.map((entry) => join(outputDir, entry.relativeAssetDir)));

  for (const stalePath of runtime.currentTestPaths) {
    if (!nextTestPaths.has(stalePath)) {
      await rm(stalePath, { force: true });
    }
  }

  for (const staleDir of runtime.currentAssetDirs) {
    if (!nextAssetDirs.has(staleDir)) {
      await rm(staleDir, { recursive: true, force: true });
    }
  }

  runtime.currentTestPaths = nextTestPaths;
  runtime.currentAssetDirs = nextAssetDirs;

  await Promise.all(
    snapshot.entries.map(async (entry) => {
      const content = renderTestFile({
        entry,
        outputDir,
      });

      await writeTextAtomic(entry.filePath, content);
    }),
  );

  await Promise.all([
    writeJson(join(outputDir, "manifest", "run.json"), toRunManifest({
      context,
      command,
      generatedAt,
      phase,
      expectations,
      projectGuide,
      snapshot,
    })),
    writeJsonlSnapshot(
      join(outputDir, "manifest", "tests.jsonl"),
      snapshot.entries.map(toTestsManifestLine),
    ),
    writeJsonlSnapshot(
      join(outputDir, "manifest", "findings.jsonl"),
      snapshot.combinedAllFindings.map(toFindingManifestLine),
    ),
    writeTextAtomic(
      join(outputDir, "index.md"),
      renderIndex({
        context,
        command,
        generatedAt,
        phase,
        stats: snapshot.stats,
        durationSummary: snapshot.durationSummary,
        environmentSummary: buildEnvironmentSummary(snapshot.entries),
        modelingSummary: snapshot.modelingSummary,
        expectations,
        tests: snapshot.entries,
        globalArtifacts: snapshot.globalArtifacts,
        globalErrors: snapshot.globalErrors,
        globalExitCode: snapshot.globalExitCode,
        qualityGateResults: snapshot.qualityGateResults,
        findings: snapshot.combinedAllFindings,
      }),
    ),
    writeTextAtomic(join(outputDir, "AGENTS.md"), renderAgentsGuide(projectGuide?.relativePath)),
  ]);
};

const createBootstrapSnapshot = (): AgentSnapshot => ({
  stats: { total: 0 },
  entries: [],
  globalArtifacts: [],
  globalErrors: [],
  globalExitCode: undefined,
  qualityGateResults: [],
  modelingSummary: {
    completeness: "complete",
    reasons: [],
    modeledStats: emptyStatusCounts(),
    unmodeledFromStats: emptyStatusCounts(),
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
  durationSummary: {
    total: 0,
    average: 0,
    max: 0,
  },
  combinedRunFindings: [],
  combinedAllFindings: [],
});

const writeBootstrapFiles = async (runtime: AgentRuntimeState) => {
  await writeTextAtomic(join(runtime.outputDir, "AGENTS.md"), renderAgentsGuide(runtime.projectGuide?.relativePath));
  await initializeJsonlStream(join(runtime.outputDir, "manifest", "test-events.jsonl"));
  await writeSnapshotFiles({
    runtime,
    snapshot: createBootstrapSnapshot(),
    phase: "running",
  });
};

const toTestsManifestLine = (entry: TestEntry) => ({
  environment_id: entry.environmentId,
  history_id: entry.tr.historyId ?? null,
  test_result_id: entry.tr.id,
  full_name: entry.tr.fullName ?? entry.tr.name,
  package: entry.packageName ?? null,
  labels: toLabelEntries(entry.tr.labels),
  status: entry.tr.status,
  duration_ms: entry.tr.duration ?? 0,
  retries: Math.max(entry.attempts.length - 1, 0),
  flaky: entry.tr.flaky,
  scope_match: entry.scope.scopeMatch,
  scope_reasons: entry.scope.reasons,
  finding_counts: toFindingCounts(entry.findings),
  markdown_path: entry.relativePath,
  assets_dir: entry.relativeAssetDir,
});

const toFindingManifestLine = (finding: AgentFinding) => ({
  finding_id: finding.findingId,
  subject: finding.subject,
  severity: finding.severity,
  category: finding.category,
  check_name: finding.checkName,
  message: finding.message,
  explanation: finding.explanation,
  evidence_paths: finding.evidencePaths,
  remediation_hint: finding.remediationHint,
  expected_reference: finding.expectedReference,
  confidence: finding.confidence,
});

const queueRuntimeTask = (runtime: AgentRuntimeState, task: () => Promise<void>) => {
  runtime.queue = runtime.queue
    .catch(() => undefined)
    .then(async () => {
      try {
        await task();
      } catch (error) {
        runtime.lastError = error as Error;
        throw error;
      }
    });

  return runtime.queue;
};

const appendRuntimeEvent = async (
  runtime: AgentRuntimeState,
  eventType: TestEventType,
  payload: Record<string, unknown>,
) => {
  runtime.eventCounter += 1;

  await appendJsonlLine(join(runtime.outputDir, "manifest", "test-events.jsonl"), {
    sequence: runtime.eventCounter,
    at: new Date().toISOString(),
    event_type: eventType,
    ...payload,
  });
};

const removeStaleLiveFiles = async (runtime: AgentRuntimeState, liveTestIds: Set<string>) => {
  for (const [testId, path] of Array.from(runtime.currentEntryPathByTestId.entries())) {
    if (!liveTestIds.has(testId)) {
      await rm(path, { force: true });
      runtime.currentEntryPathByTestId.delete(testId);
      runtime.currentTestPaths.delete(path);
    }
  }

  for (const [testId, assetDir] of Array.from(runtime.currentAssetDirByTestId.entries())) {
    if (!liveTestIds.has(testId)) {
      await rm(assetDir, { recursive: true, force: true });
      runtime.currentAssetDirByTestId.delete(testId);
      runtime.currentAssetDirs.delete(assetDir);
    }
  }
};

const writeLiveEntry = async (runtime: AgentRuntimeState, entry: TestEntry) => {
  const previousPath = runtime.currentEntryPathByTestId.get(entry.tr.id);
  const previousAssetDir = runtime.currentAssetDirByTestId.get(entry.tr.id);

  if (previousPath && previousPath !== entry.filePath) {
    await rm(previousPath, { force: true });
    runtime.currentTestPaths.delete(previousPath);
  }

  if (previousAssetDir && previousAssetDir !== join(runtime.outputDir, entry.relativeAssetDir)) {
    await rm(previousAssetDir, { recursive: true, force: true });
    runtime.currentAssetDirs.delete(previousAssetDir);
  }

  await writeTextAtomic(
    entry.filePath,
    renderTestFile({
      entry,
      outputDir: runtime.outputDir,
    }),
  );

  runtime.currentEntryPathByTestId.set(entry.tr.id, entry.filePath);
  runtime.currentAssetDirByTestId.set(entry.tr.id, join(runtime.outputDir, entry.relativeAssetDir));
  runtime.currentTestPaths.add(entry.filePath);
  runtime.currentAssetDirs.add(join(runtime.outputDir, entry.relativeAssetDir));
};

const buildImpactedLiveEntries = async (runtime: AgentRuntimeState, trIds: string[]) => {
  const changedIds = new Set(trIds);
  const layouts = await listVisibleTestLayouts({
    outputDir: runtime.outputDir,
    store: runtime.store,
  });
  const liveTestIds = new Set(layouts.map(({ tr }) => tr.id));
  const impactedLayouts: TestEntryLayout[] = [];

  await removeStaleLiveFiles(runtime, liveTestIds);

  for (const layout of layouts) {
    const previousPath = runtime.currentEntryPathByTestId.get(layout.tr.id);
    const previousAssetDir = runtime.currentAssetDirByTestId.get(layout.tr.id);
    const nextAssetDir = join(runtime.outputDir, layout.relativeAssetDir);
    let impacted = changedIds.has(layout.tr.id) || previousPath !== layout.filePath || previousAssetDir !== nextAssetDir;

    if (!impacted) {
      const retries = await runtime.store.retriesByTr(layout.tr);

      impacted = retries.some((retry) => changedIds.has(retry.id));
    }

    if (impacted) {
      impactedLayouts.push(layout);
    }
  }

  const entries: TestEntry[] = [];

  for (const layout of impactedLayouts) {
    entries.push(
      await buildEntryFromLayout({
        layout,
        store: runtime.store,
        expectations: runtime.expectations,
      }),
    );
  }

  return entries;
};

const streamLiveTestUpdates = async (runtime: AgentRuntimeState, trIds: string[]) => {
  const entries = await buildImpactedLiveEntries(runtime, trIds);

  for (const entry of entries) {
    await writeLiveEntry(runtime, entry);

    const eventType: TestEventType = runtime.seenLogicalKeys.has(entry.key) ? "test_updated" : "test_completed";

    runtime.seenLogicalKeys.add(entry.key);

    await appendRuntimeEvent(runtime, eventType, {
      logical_key: entry.key,
      markdown_path: entry.relativePath,
      assets_dir: entry.relativeAssetDir,
      environment_id: entry.environmentId,
      test_result_id: entry.tr.id,
      related_test_result_ids: entry.attempts.map((attempt) => attempt.tr.id),
      full_name: entry.tr.fullName ?? entry.tr.name,
      status: entry.tr.status,
      retries: Math.max(entry.attempts.length - 1, 0),
      finding_counts: toFindingCounts(entry.findings),
    });
  }
};

const createRuntimeState = async (params: {
  options: AgentPluginOptions;
  context: PluginContext;
  store: AllureStore;
}) => {
  const { options, context, store } = params;
  const outputDir = resolveOutputDir(options);

  if (!outputDir) {
    return undefined;
  }

  await mkdir(outputDir, { recursive: true });
  await cleanupManagedEntries(outputDir);

  const generatedAt = new Date().toISOString();
  const createFinding = createFindingFactory();
  const expectationLoadResult = await loadExpectations(outputDir, createFinding);
  const projectGuide = await loadProjectGuide(outputDir);
  const runtime: AgentRuntimeState = {
    outputDir,
    context,
    store,
    generatedAt,
    command: env[AGENT_COMMAND_ENV],
    createFinding,
    expectations: expectationLoadResult.expectations,
    expectationLoadFindings: expectationLoadResult.findings,
    projectGuide,
    unsubscribers: [],
    queue: Promise.resolve(),
    seenLogicalKeys: new Set<string>(),
    currentTestPaths: new Set<string>(),
    currentAssetDirs: new Set<string>(),
    currentEntryPathByTestId: new Map<string, string>(),
    currentAssetDirByTestId: new Map<string, string>(),
    finalized: false,
    eventCounter: 0,
  };

  await writeBootstrapFiles(runtime);

  return runtime;
};

export class AgentPlugin implements Plugin {
  #runtime?: AgentRuntimeState;

  constructor(readonly options: AgentPluginOptions = {}) {}

  start = async (context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void> => {
    if (this.#runtime) {
      return;
    }

    const runtime = await createRuntimeState({
      options: this.options,
      context,
      store,
    });

    if (!runtime) {
      return;
    }

    runtime.unsubscribers.push(
      realtime.onTestResults(
        async (trIds) => {
          await queueRuntimeTask(runtime, async () => {
            await streamLiveTestUpdates(runtime, trIds);
          });
        },
        { maxTimeout: 0 },
      ),
    );
    runtime.unsubscribers.push(
      realtime.onGlobalAttachment(async () => {
        await queueRuntimeTask(runtime, async () => {
          // Global artifacts are finalized from the store in done(). Live consumers should
          // use test-events plus per-test markdown for fast feedback during the run.
        });
      }),
    );
    runtime.unsubscribers.push(
      realtime.onGlobalError(async (error) => {
        await queueRuntimeTask(runtime, async () => {
          await appendRuntimeEvent(runtime, "run_error", {
            message: error.message ?? "Captured global error",
          });
        });
      }),
    );
    runtime.unsubscribers.push(
      realtime.onGlobalExitCode(async (payload) => {
        await queueRuntimeTask(runtime, async () => {
          if ((payload.actual ?? payload.original) !== 0) {
            await appendRuntimeEvent(runtime, "run_error", {
              message: `Observed exit code ${payload.actual ?? payload.original}`,
              exit_code: payload,
            });
          }
        });
      }),
    );
    runtime.unsubscribers.push(
      realtime.onQualityGateResults(async (results) => {
        await queueRuntimeTask(runtime, async () => {
          if (results.some(({ success }) => !success)) {
            await appendRuntimeEvent(runtime, "run_warning", {
              message: "Quality gate reported failing rules during the run.",
              failed_rules: results.filter(({ success }) => !success).map(({ rule, environment, message }) => ({
                rule,
                environment,
                message,
              })),
            });
          }
        });
      }),
    );

    this.#runtime = runtime;
  };

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    const runtime =
      this.#runtime ??
      (await createRuntimeState({
        options: this.options,
        context,
        store,
      }));

    if (!runtime) {
      return;
    }

    this.#runtime = runtime;

    if (runtime.finalized) {
      return;
    }

    await runtime.queue.catch(() => undefined);

    for (const unsubscribe of runtime.unsubscribers.splice(0)) {
      unsubscribe();
    }

    const snapshot = await buildSnapshot({
      outputDir: runtime.outputDir,
      store: runtime.store,
      expectations: runtime.expectations,
      expectationLoadFindings: runtime.expectationLoadFindings,
      createFinding: runtime.createFinding,
    });

    await writeSnapshotFiles({
      runtime,
      snapshot,
      phase: "done",
    });
    await appendRuntimeEvent(runtime, "run_finished", {
      completeness: snapshot.modelingSummary.completeness,
      findings: snapshot.combinedAllFindings.length,
      logical_tests: snapshot.entries.length,
    });

    runtime.finalized = true;

    if (runtime.lastError) {
      throw runtime.lastError;
    }
  };
}
