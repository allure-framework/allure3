import {
  AllureCheckResult,
  type AllureHistory,
  type CiDescriptor,
  type TestResult,
  getWorstStatus,
} from "@allurereport/core-api";

import type { PluginSummary, SummaryCheckResult, TestResultRegistry, TestResultSummary } from "../plugin.js";
import type { AllureStore } from "../store.js";

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
  const mainBranchHistory = (await history?.readHistory?.({ branch: "" })) ?? [];
  const newTrs = await store.allNewTestResults(filter, mainBranchHistory);
  const retryFlags = await Promise.all(allTrs.map(async (tr) => (await store.retriesByTr(tr)).length > 0));
  const retryTrs = allTrs.filter((_, index) => retryFlags[index]);
  const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
  const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
  const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
  const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

  return {
    stats: await store.testsStatistic(filter),
    status: worstStatus ?? "passed",
    newTests: newTrs.map(({ id }) => id),
    flakyTests: flakyTrs.map(({ id }) => id),
    retryTests: retryTrs.map(({ id }) => id),
    checks: allChecks.map(convertToSummaryCheckResult),
    name,
    duration,
    createdAt,
    plugin,
    meta,
  };
};
