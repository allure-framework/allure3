import {
  AllureCheckResult,
  type AllureHistory,
  type CiDescriptor,
  type TestResult,
  type TestStatus,
  getWorstStatus,
} from "@allurereport/core-api";

import type { ExitCode, PluginSummary, SummaryCheckResult, TestResultRegistry, TestResultSummary } from "../plugin.js";
import type { ReportRunSummary } from "../report.js";
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
 * Returns the time span of the run, from the earliest start to the latest stop of the given test results,
 * the results without timings are skipped.
 * The duration is the wall clock time of that span without the pauses longer than {@link RUN_IDLE_GAP_LIMIT}
 * during which no test was running.
 */
export const getRunSummary = (testResults: Pick<TestResult, "start" | "stop">[]): ReportRunSummary | undefined => {
  const intervals: [start: number, stop: number][] = [];

  for (const { start, stop } of testResults) {
    if (typeof start === "number" && Number.isFinite(start) && typeof stop === "number" && Number.isFinite(stop)) {
      intervals.push([start, stop]);
    }
  }

  if (intervals.length === 0) {
    return undefined;
  }

  intervals.sort((a, b) => a[0] - b[0]);

  const runStart = intervals[0][0];
  let runStop = -Infinity;
  let duration = 0;
  let [activeStart, activeStop] = intervals[0];

  for (const [start, stop] of intervals) {
    runStop = Math.max(runStop, stop);

    if (start - activeStop > RUN_IDLE_GAP_LIMIT) {
      duration += Math.max(0, activeStop - activeStart);
      activeStart = start;
      activeStop = stop;
      continue;
    }

    activeStop = Math.max(activeStop, stop);
  }

  return { start: runStart, stop: runStop, duration: duration + Math.max(0, activeStop - activeStart) };
};

export const calculateRunDuration = (testResults: Pick<TestResult, "start" | "stop" | "duration">[]): number =>
  getRunSummary(testResults)?.duration ?? testResults.reduce((acc, { duration = 0 }) => acc + duration, 0);

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
  // a retried attempt is still test activity: without it a long first attempt would look like an idle gap
  const duration = calculateRunDuration(await store.allTestResults({ includeRetries: true, filter }));
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
