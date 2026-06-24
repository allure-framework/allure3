import {
  AllureCheckResult,
  type AllureHistory,
  type CiDescriptor,
  type TestResult,
  getWorstStatus,
} from "@allurereport/core-api";

import type { PluginSummary, SummaryCheckResult, SummaryTestResult } from "../plugin.js";
import type { AllureStore } from "../store.js";

export const convertToSummaryTestResult = (tr: TestResult): SummaryTestResult => ({
  id: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
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
  const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
  const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
  const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
  const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
  const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

  return {
    stats: await store.testsStatistic(filter),
    status: worstStatus ?? "passed",
    newTests: newTrs.map(convertToSummaryTestResult),
    flakyTests: flakyTrs.map(convertToSummaryTestResult),
    retryTests: retryTrs.map(convertToSummaryTestResult),
    checks: allChecks.map(convertToSummaryCheckResult),
    name,
    duration,
    createdAt,
    plugin,
    meta,
  };
};
