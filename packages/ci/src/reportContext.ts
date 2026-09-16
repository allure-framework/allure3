import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { TestStatus } from "@allurereport/core-api";
import type { PluginSummary, QualityGateValidationResult, TestResultRegistry } from "@allurereport/plugin-api";
import { glob } from "glob";

const TEST_RESULTS_REGISTRY_FILENAME = "test-results.json";
const QUALITY_GATE_RESULTS_FILENAME = "quality-gate.json";
const ARTIFACTS_MANIFEST_FILENAME = "artifacts.json";
const SUMMARY_FILENAME = "summary.json";

const TEST_STATUSES = ["failed", "broken", "passed", "skipped", "unknown"] as const satisfies TestStatus[];

type UnknownRecord = Record<string, unknown>;

export type ReportContextStatusStats = Record<(typeof TEST_STATUSES)[number], number> & {
  total: number;
};

export type ReportContextFlagStats = {
  new: number;
  flaky: number;
  retry: number;
};

export type ReportContextResolutionStats = {
  issues: number;
  muted: number;
  accepted: number;
};

export type ReportContextEnvironment = {
  name: string;
  stats: ReportContextStatusStats;
  flags: ReportContextFlagStats;
  duration: number;
};

export type ReportContextReport = PluginSummary & {
  summaryFile?: string;
  reportPath?: string;
};

export type ReportContextArtifact = {
  name: string;
  path: string;
};

export type ReportContextTotals = {
  stats: ReportContextStatusStats;
  flags: ReportContextFlagStats;
  resolutions: ReportContextResolutionStats;
  /**
   * Sum of test-result durations when the compact registry is available.
   * Falls back to the max report summary duration when the context is built from summaries only.
   */
  duration: number;
};

/**
 * Allure 3 writes a flat array today. CI integrations may still pass environment-keyed results
 * when building context from in-memory data.
 */
export type ReportContextQualityGate = QualityGateValidationResult[] | Record<string, QualityGateValidationResult[]>;

export type ReportContext = {
  reports: ReportContextReport[];
  testResults?: TestResultRegistry;
  totals: ReportContextTotals;
  environments: ReportContextEnvironment[];
  artifacts: ReportContextArtifact[];
  qualityGate?: ReportContextQualityGate;
};

export type ReportContextData = {
  reports?: ReportContextReport[];
  summaries?: PluginSummary[];
  testResults?: TestResultRegistry;
  artifacts?: ReportContextArtifact[];
  qualityGate?: ReportContextQualityGate;
};

export type ReadReportContextFilesOptions = {
  onError?: (message: string) => void;
};

export type CreateReportContextOptions = ReadReportContextFilesOptions;

const emptyStatusStats = (): ReportContextStatusStats => ({
  failed: 0,
  broken: 0,
  passed: 0,
  skipped: 0,
  unknown: 0,
  total: 0,
});

const emptyFlagStats = (): ReportContextFlagStats => ({
  new: 0,
  flaky: 0,
  retry: 0,
});

const emptyResolutionStats = (): ReportContextResolutionStats => ({
  issues: 0,
  muted: 0,
  accepted: 0,
});

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTestStatus = (value: unknown): value is TestStatus =>
  typeof value === "string" && TEST_STATUSES.includes(value as TestStatus);

const normalizePath = (filePath: string): string => filePath.split(sep).join("/");

const readOptionalJson = async (filePath: string, onError?: (message: string) => void): Promise<unknown> => {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (err) {
    onError?.(`Failed to read Allure report context file ${filePath}: ${String(err)}`);
    return undefined;
  }
};

const isPluginSummary = (value: unknown): value is PluginSummary => {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.stats)) {
    return false;
  }

  return typeof value.duration === "number" && isTestStatus(value.status);
};

const getReportPath = (reportDir: string, summaryFile: string): string =>
  normalizePath(relative(resolve(reportDir), dirname(resolve(summaryFile))));

const readPluginSummary = async (
  reportDir: string,
  filePath: string,
  onError?: (message: string) => void,
): Promise<ReportContextReport | undefined> => {
  const value = await readOptionalJson(filePath, onError);

  if (value === undefined) {
    return undefined;
  }

  if (!isPluginSummary(value)) {
    onError?.(`Ignoring unsupported Allure plugin summary file ${filePath}`);
    return undefined;
  }

  return {
    ...value,
    summaryFile: filePath,
    reportPath: getReportPath(reportDir, filePath),
  };
};

const findSummaryFiles = async (reportDir: string): Promise<string[]> =>
  (
    await glob(`**/${SUMMARY_FILENAME}`, {
      absolute: true,
      cwd: reportDir,
      ignore: [`**/widgets/${SUMMARY_FILENAME}`],
      nodir: true,
    })
  ).toSorted((left, right) => left.localeCompare(right));

const normalizeTestResultRegistry = (
  value: unknown,
  onError?: (message: string) => void,
): TestResultRegistry | undefined => {
  if (!isRecord(value) || !isRecord(value.byId)) {
    if (value !== undefined) {
      onError?.("Ignoring unsupported Allure test result registry shape");
    }

    return undefined;
  }

  return {
    byId: value.byId as TestResultRegistry["byId"],
  };
};

const normalizeArtifacts = (value: unknown, onError?: (message: string) => void): ReportContextArtifact[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    onError?.("Ignoring unsupported Allure artifacts manifest shape");
    return [];
  }

  const byPath = new Map<string, ReportContextArtifact>();

  value.forEach((artifact) => {
    if (!isRecord(artifact) || typeof artifact.name !== "string" || typeof artifact.path !== "string") {
      return;
    }

    if (!byPath.has(artifact.path)) {
      byPath.set(artifact.path, {
        name: artifact.name,
        path: artifact.path,
      });
    }
  });

  return [...byPath.values()].toSorted(
    (left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name),
  );
};

const isQualityGateResult = (value: unknown): value is QualityGateValidationResult => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.success === "boolean" && typeof value.rule === "string" && typeof value.message === "string";
};

const normalizeQualityGate = (
  value: unknown,
  onError?: (message: string) => void,
): ReportContextQualityGate | undefined => {
  if (Array.isArray(value)) {
    return value.filter(isQualityGateResult);
  }

  if (!isRecord(value)) {
    if (value !== undefined) {
      onError?.("Ignoring unsupported Allure quality gate results shape");
    }

    return undefined;
  }

  const entries = Object.entries(value).flatMap(([environment, results]) =>
    Array.isArray(results) ? [[environment, results.filter(isQualityGateResult)] as const] : [],
  );

  if (!entries.length) {
    if (Object.keys(value).length > 0) {
      onError?.("Ignoring unsupported Allure quality gate results shape");
    }

    return undefined;
  }

  return Object.fromEntries(entries);
};

const addStatus = (stats: ReportContextStatusStats, status: TestStatus): void => {
  stats[status] += 1;
  stats.total += 1;
};

const getSummaryIdSet = (summaries: PluginSummary[], key: "newTests" | "flakyTests" | "retryTests"): Set<string> =>
  new Set(summaries.flatMap((summary) => summary[key] ?? []));

const applyMaxSummaryStats = (stats: ReportContextStatusStats, summaries: PluginSummary[]): void => {
  summaries.forEach((summary) => {
    TEST_STATUSES.forEach((status) => {
      stats[status] = Math.max(stats[status], summary.stats[status] ?? 0);
    });
    stats.total = Math.max(stats.total, summary.stats.total);
  });
};

const createTotals = (registry: TestResultRegistry | undefined, summaries: PluginSummary[]): ReportContextTotals => {
  const totals: ReportContextTotals = {
    stats: emptyStatusStats(),
    flags: emptyFlagStats(),
    resolutions: emptyResolutionStats(),
    duration: 0,
  };

  if (!registry) {
    applyMaxSummaryStats(totals.stats, summaries);
    totals.duration = summaries.reduce((max, summary) => Math.max(max, summary.duration), 0);

    return totals;
  }

  Object.values(registry.byId).forEach((testResult) => {
    if (!isRecord(testResult) || !isTestStatus(testResult.status)) {
      return;
    }

    addStatus(totals.stats, testResult.status);

    if (typeof testResult.duration === "number") {
      totals.duration += testResult.duration;
    }
  });

  return totals;
};

const addFlags = (
  flags: ReportContextFlagStats,
  testResultId: string,
  newTestIds: Set<string>,
  flakyTestIds: Set<string>,
  retryTestIds: Set<string>,
): void => {
  if (newTestIds.has(testResultId)) {
    flags.new += 1;
  }

  if (flakyTestIds.has(testResultId)) {
    flags.flaky += 1;
  }

  if (retryTestIds.has(testResultId)) {
    flags.retry += 1;
  }
};

const createEnvironmentContext = (
  registry: TestResultRegistry | undefined,
  summaries: PluginSummary[],
): ReportContextEnvironment[] => {
  if (!registry) {
    return [];
  }

  const newTestIds = getSummaryIdSet(summaries, "newTests");
  const flakyTestIds = getSummaryIdSet(summaries, "flakyTests");
  const retryTestIds = getSummaryIdSet(summaries, "retryTests");
  const environmentsByName = new Map<string, ReportContextEnvironment>();

  Object.entries(registry.byId).forEach(([testResultId, testResult]) => {
    if (!isRecord(testResult) || !isTestStatus(testResult.status) || typeof testResult.environment !== "string") {
      return;
    }

    const environment = testResult.environment.trim();

    if (!environment || environment === "default") {
      return;
    }

    const context = environmentsByName.get(environment) ?? {
      name: environment,
      stats: emptyStatusStats(),
      flags: emptyFlagStats(),
      duration: 0,
    };

    addStatus(context.stats, testResult.status);
    addFlags(context.flags, testResultId, newTestIds, flakyTestIds, retryTestIds);

    if (typeof testResult.duration === "number") {
      context.duration += testResult.duration;
    }

    environmentsByName.set(environment, context);
  });

  return [...environmentsByName.values()].toSorted((left, right) => left.name.localeCompare(right.name));
};

const createReport = (summary: PluginSummary): ReportContextReport => ({ ...summary });

const sortReports = (reports: ReportContextReport[]): ReportContextReport[] =>
  reports.toSorted((left, right) => left.name.localeCompare(right.name));

const getResolutionStats = (summaries: PluginSummary[]): ReportContextResolutionStats => {
  const stats = emptyResolutionStats();

  summaries.forEach((summary) => {
    stats.issues = Math.max(stats.issues, summary.stats.resolutions?.issues ?? 0);
    stats.muted = Math.max(stats.muted, summary.stats.resolutions?.muted ?? 0);
    stats.accepted = Math.max(stats.accepted, summary.stats.resolutions?.accepted ?? 0);
  });

  return stats;
};

const applySummaryFlags = (totals: ReportContextTotals, summaries: PluginSummary[]): void => {
  totals.flags.new = getSummaryIdSet(summaries, "newTests").size;
  totals.flags.flaky = getSummaryIdSet(summaries, "flakyTests").size;
  totals.flags.retry = getSummaryIdSet(summaries, "retryTests").size;
  totals.resolutions = getResolutionStats(summaries);
};

export const readReportContextFiles = async (
  reportDir: string,
  options: ReadReportContextFilesOptions = {},
): Promise<ReportContextData> => {
  const { onError } = options;
  const summaryFiles = await findSummaryFiles(reportDir);
  const reports = (
    await Promise.all(summaryFiles.map((summaryFile) => readPluginSummary(reportDir, summaryFile, onError)))
  ).filter((summary): summary is ReportContextReport => summary !== undefined);
  const registry = normalizeTestResultRegistry(
    await readOptionalJson(join(reportDir, TEST_RESULTS_REGISTRY_FILENAME), onError),
    onError,
  );
  const artifacts = normalizeArtifacts(
    await readOptionalJson(join(reportDir, ARTIFACTS_MANIFEST_FILENAME), onError),
    onError,
  );
  const qualityGate = normalizeQualityGate(
    await readOptionalJson(join(reportDir, QUALITY_GATE_RESULTS_FILENAME), onError),
    onError,
  );

  return {
    reports,
    testResults: registry,
    artifacts,
    qualityGate,
  };
};

export const createReportContextFromData = (data: ReportContextData): ReportContext => {
  const reports = sortReports(data.reports ?? data.summaries?.map(createReport) ?? []);
  const artifacts = [...(data.artifacts ?? [])].toSorted(
    (left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name),
  );
  const totals = createTotals(data.testResults, reports);

  applySummaryFlags(totals, reports);

  return {
    reports,
    testResults: data.testResults,
    totals,
    environments: createEnvironmentContext(data.testResults, reports),
    artifacts,
    qualityGate: data.qualityGate,
  };
};

export const createReportContext = async (
  reportDir: string,
  options: CreateReportContextOptions = {},
): Promise<ReportContext> => createReportContextFromData(await readReportContextFiles(reportDir, options));
