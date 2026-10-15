import {
  type Statistic,
  type TestResult,
  formatDuration,
  getSuccessRate,
  getWorstStatus,
} from "@allurereport/core-api";
import { type AllureStore, type PluginContext, calculateRunDuration } from "@allurereport/plugin-api";

import type { MailCiInfo, MailData, MailPluginOptions } from "./model.js";

export const DEFAULT_MAX_FAILED = 20;
const MAX_MESSAGE_LENGTH = 300;

const failedFirst: string[] = ["failed", "broken"];

const rank = (status: string): number => {
  const index = failedFirst.indexOf(status);

  return index === -1 ? failedFirst.length : index;
};

const compareFailed = (a: TestResult, b: TestResult): number =>
  rank(a.status) - rank(b.status) || (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name);

const normalizeLimit = (value: number): number =>
  Number.isNaN(value) ? DEFAULT_MAX_FAILED : Math.max(0, Math.floor(value));

/** Never rounds up to 100% while some tests did not pass */
const getPassRate = (stats: Statistic): number => {
  const rate = getSuccessRate(stats);

  return rate >= 1 ? 100 : Math.min(99, Math.round(rate * 100));
};

const formatRunDuration = (duration: number): string =>
  formatDuration(duration >= 1000 ? Math.round(duration / 1000) * 1000 : duration).replace(/ 0ms$/, "");

const shorten = (message?: string): string | undefined => {
  const text = message?.replace(/\s+/g, " ").trim();

  if (!text) {
    return undefined;
  }

  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
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
  const limit = normalizeLimit(maxFailed);
  const stats = await store.testsStatistic();
  const testResults = await store.allTestResults();
  const failedResults = [...(await store.failedTestResults())].sort(compareFailed);

  return {
    title: title || context.reportName,
    status: getWorstStatus(testResults.map(({ status }) => status)) ?? "passed",
    stats,
    passRate: getPassRate(stats),
    duration: formatRunDuration(calculateRunDuration(testResults)),
    reportUrl: reportUrl || context.reportUrl,
    ci: getCiInfo(context.ci),
    failed: failedResults.slice(0, limit).map((tr) => ({
      name: tr.fullName ?? tr.name,
      status: tr.status,
      message: shorten(tr.error?.message),
    })),
    hiddenFailed: Math.max(0, failedResults.length - limit),
  };
};
