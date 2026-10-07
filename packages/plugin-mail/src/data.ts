import { type TestResult, formatDuration, getWorstStatus } from "@allurereport/core-api";
import { type AllureStore, type PluginContext, calculateRunDuration } from "@allurereport/plugin-api";

import type { MailCiInfo, MailData, MailPluginOptions } from "./model.js";

export const DEFAULT_MAX_FAILED = 20;
const MAX_MESSAGE_LENGTH = 300;

const statusOrder: Record<string, number> = { failed: 0, broken: 1 };

const compareFailed = (a: TestResult, b: TestResult): number =>
  (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) ||
  (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name);

const formatRunDuration = (duration: number): string =>
  formatDuration(duration >= 1000 ? Math.round(duration / 1000) * 1000 : duration).replace(/ 0ms$/, "");

const shorten = (message?: string): string | undefined => {
  const line = message?.trim();

  if (!line) {
    return undefined;
  }

  return line.length > MAX_MESSAGE_LENGTH ? `${line.slice(0, MAX_MESSAGE_LENGTH)}…` : line;
};

const getCiInfo = (ci: PluginContext["ci"]): MailCiInfo | undefined => {
  if (!ci?.detected) {
    return undefined;
  }

  const info: MailCiInfo = {
    name: ci.jobRunName || ci.jobName || undefined,
    url: ci.jobRunUrl || ci.jobUrl || undefined,
    branch: ci.jobRunBranch || ci.sourceBranch || undefined,
    pullRequestName: ci.pullRequestName || undefined,
    pullRequestUrl: ci.pullRequestUrl || undefined,
  };

  return Object.values(info).some(Boolean) ? info : undefined;
};

export const collectMailData = async (
  context: PluginContext,
  store: AllureStore,
  options: MailPluginOptions = {},
): Promise<MailData> => {
  const { title, reportUrl, maxFailed = DEFAULT_MAX_FAILED } = options;
  const stats = await store.testsStatistic();
  const testResults = await store.allTestResults();
  const failedResults = (await store.failedTestResults()).sort(compareFailed);
  const limit = Math.max(0, maxFailed);

  return {
    title: title ?? context.reportName,
    status: getWorstStatus(testResults.map(({ status }) => status)) ?? "passed",
    stats,
    passRate: stats.total > 0 ? Math.round(((stats.passed ?? 0) / stats.total) * 100) : 0,
    duration: formatRunDuration(calculateRunDuration(testResults)),
    reportUrl: reportUrl ?? context.reportUrl,
    ci: getCiInfo(context.ci),
    failed: failedResults.slice(0, limit).map((tr) => ({
      name: tr.fullName ?? tr.name,
      status: tr.status,
      message: shorten(tr.error?.message),
    })),
    hiddenFailed: Math.max(0, failedResults.length - limit),
  };
};
