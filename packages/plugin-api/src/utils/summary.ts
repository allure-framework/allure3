import {
  AllureCheckResult,
  type AllureHistory,
  type CiDescriptor,
  type TestResult,
  type TestStatus,
  getWorstStatus,
} from "@allurereport/core-api";

import type { ExitCode, PluginSummary, SummaryCheckResult, TestResultRegistry, TestResultSummary } from "../plugin.js";
import type { AllureStore } from "../store.js";

/**
 * Resolves overall report status from global errors, exit code, and test statuses.
 * Precedence: any global error -> failed; nonzero exit -> failed; else worst test status (or passed).
 */
export const resolveReportStatus = (params: {
  globalErrorsCount: number;
  exitCode?: ExitCode;
  testStatuses: TestStatus[];
}): TestStatus => {
  if (params.globalErrorsCount > 0) {
    return "failed";
  }

  const code = params.exitCode?.actual ?? params.exitCode?.original;

  if (code !== undefined && code !== 0) {
    return "failed";
  }

  return getWorstStatus(params.testStatuses) ?? "passed";
};

export const convertToTestResultSummary = (tr: TestResult): TestResultSummary => ({
  id: tr.id,
  name: tr.name,
  duration: tr.duration,
  status: tr.status,
  ...(tr.environment ? { environment: tr.environment } : {}),
});

export const createTestResultRegistry = (testResults: TestResult[]): TestResultRegistry => ({
  byId: Object.fromEntries(testResults.map((testResult) => [testResult.id, convertToTestResultSummary(testResult)])),
});

export const convertToSummaryCheckResult = (check: AllureCheckResult): SummaryCheckResult => ({
  id: check.id,
  name: check.name,
  status: check.status,
});

/**
 * The longest pause between test activity that still counts as part of one run.
 * Results merged from runs made hours or days apart would otherwise turn the time
 * between those runs into "duration".
 */
export const RUN_IDLE_GAP_LIMIT = 60 * 60 * 1000;

/**
 * Wall clock duration of the run: from the first test start to the last test stop,
 * without the pauses longer than {@link RUN_IDLE_GAP_LIMIT} during which no test was running.
 * Falls back to the sum of durations when no test result has valid time bounds.
 */
export const calculateRunDuration = (testResults: Pick<TestResult, "start" | "stop" | "duration">[]): number => {
  const intervals: [start: number, stop: number][] = [];

  for (const { start, stop } of testResults) {
    if (typeof start === "number" && Number.isFinite(start) && typeof stop === "number" && Number.isFinite(stop)) {
      intervals.push([start, Math.max(start, stop)]);
    }
  }

  if (intervals.length === 0) {
    return testResults.reduce((acc, { duration = 0 }) => acc + duration, 0);
  }

  intervals.sort((a, b) => a[0] - b[0]);

  let total = 0;
  let [activeStart, activeStop] = intervals[0];

  for (const [start, stop] of intervals) {
    if (start - activeStop > RUN_IDLE_GAP_LIMIT) {
      total += activeStop - activeStart;
      activeStart = start;
      activeStop = stop;
      continue;
    }

    activeStop = Math.max(activeStop, stop);
  }

  return total + (activeStop - activeStart);
};

export const createPluginSummary = async (params: {
  filter?: (testResult: TestResult) => boolean;
  name: string;
  plugin: string;
  store: AllureStore;
  history?: AllureHistory;
  ci?: CiDescriptor;
  meta: Record<string, any>;
}): Promise<PluginSummary> => {
  const { name, filter, plugin, store, history, meta } = params;
  const allChecks = await store.allCheckResults();
  const allTrs = await store.allTestResults({ filter });
  const allTrsWithRetries = await store.allTestResults({ includeRetries: true });
  const currentIds = new Set(allTrs.map(({ id }) => id));
  const mainBranchHistory = (await history?.readHistory?.({ branch: "" })) ?? [];
  const newTrs = await store.allNewTestResults(filter, mainBranchHistory);
  const retryHashesWithRetries = new Set(
    allTrsWithRetries.flatMap((tr) => (tr.isRetry && tr.retryHash ? [tr.retryHash] : [])),
  );
  const retryTrs = allTrs.filter(({ retryHash }) => retryHash && retryHashesWithRetries.has(retryHash));
  const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
  const duration = calculateRunDuration(allTrs);
  const exitCode = await store.globalExitCode();
  const globalErrors = await store.allGlobalErrors();
  const status = resolveReportStatus({
    globalErrorsCount: globalErrors.length,
    exitCode,
    testStatuses: allTrs.map(({ status: testStatus }) => testStatus),
  });
  const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

  return {
    stats: await store.testsStatistic(filter),
    status,
    newTests: newTrs.filter(({ id }) => currentIds.has(id)).map(({ id }) => id),
    flakyTests: flakyTrs.map(({ id }) => id),
    retryTests: retryTrs.map(({ id }) => id),
    checks: allChecks.map(convertToSummaryCheckResult),
    name,
    duration,
    createdAt,
    ...(exitCode ? { exitCode } : {}),
    ...(globalErrors.length > 0 ? { globalErrorsCount: globalErrors.length } : {}),
    ...(filter ? { filtered: true } : {}),
    plugin,
    meta,
  };
};
