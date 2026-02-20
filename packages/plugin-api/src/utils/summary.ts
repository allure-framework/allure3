import { type AllureHistory, type CiDescriptor, type TestResult, getWorstStatus } from "@allurereport/core-api";
import type { PluginSummary, SummaryTestResult } from "../plugin.js";
import type { AllureStore } from "../store.js";

export const convertToSummaryTestResult = (tr: TestResult): SummaryTestResult => ({
  id: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
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
  const allTrs = await store.allTestResults({ filter });
  const mainBranchHistory = (await history?.readHistory?.({ branch: "" })) ?? [];
  const newTrs = await store.allNewTestResults(filter, mainBranchHistory);
  const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
  const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
  const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
  const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
  const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);
  const summary: PluginSummary = {
    stats: await store.testsStatistic(filter),
    status: worstStatus ?? "passed",
    newTests: newTrs.map(convertToSummaryTestResult),
    flakyTests: flakyTrs.map(convertToSummaryTestResult),
    retryTests: retryTrs.map(convertToSummaryTestResult),
    name,
    duration,
    createdAt,
    plugin,
    meta,
  };

  return summary;
};
