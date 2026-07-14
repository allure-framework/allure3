import { createHash } from "node:crypto";

import { fallbackTestCaseIdLabelName } from "../constants.js";
import type { HistoryDataPoint, HistoryTestResult } from "../history.js";
import type { TestParameter } from "../metadata.js";
import type { TestResult } from "../model.js";
import { findLastByLabelName } from "./label.js";

const md5 = (data: string) => createHash("md5").update(data).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeHistoryTestResults = (testResults: unknown): Record<string, HistoryTestResult> => {
  if (!isRecord(testResults)) {
    return {};
  }

  return Object.fromEntries(Object.entries(testResults).filter(([, value]) => isRecord(value))) as Record<
    string,
    HistoryTestResult
  >;
};

const normalizeHistoryMetrics = (metrics: unknown): Record<string, number> => {
  if (!isRecord(metrics)) {
    return {};
  }

  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => Number.isFinite(value))) as Record<
    string,
    number
  >;
};

const parametersCompare = (a: TestParameter, b: TestParameter) => {
  return (a.name ?? "").localeCompare(b.name ?? "") || (a.value ?? "").localeCompare(b.value ?? "");
};

export const stringifyHistoryParams = (parameters: TestParameter[] = []): string => {
  return [...parameters]
    .filter((parameter) => !parameter?.excluded)
    .sort(parametersCompare)
    .map((parameter) => `${parameter.name}:${parameter.value}`)
    .join(",");
};

export const getFallbackHistoryId = (tr: Pick<TestResult, "labels" | "parameters">): string | undefined => {
  const fallbackTestCaseId = findLastByLabelName(tr.labels ?? [], fallbackTestCaseIdLabelName);

  if (!fallbackTestCaseId) {
    return undefined;
  }

  return `${fallbackTestCaseId}.${md5(stringifyHistoryParams(tr.parameters ?? []))}`;
};

export const getHistoryIdCandidates = (tr: Pick<TestResult, "historyId" | "labels" | "parameters">): string[] => {
  const result: string[] = [];

  if (tr.historyId) {
    result.push(tr.historyId);
  }

  const fallbackHistoryId = getFallbackHistoryId(tr);

  if (fallbackHistoryId && !result.includes(fallbackHistoryId)) {
    result.push(fallbackHistoryId);
  }

  return result;
};

export const filterUnknownByKnownIssues = (
  trs: TestResult[],
  knownIssueHistoryIds: ReadonlySet<string>,
): TestResult[] => {
  return trs.filter((tr) => {
    const historyIdCandidates = getHistoryIdCandidates(tr);

    if (historyIdCandidates.length === 0) {
      return true;
    }

    return historyIdCandidates.every((historyId) => !knownIssueHistoryIds.has(historyId));
  });
};

export const normalizeHistoryDataPoint = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => ({
  ...historyDataPoint,
  knownTestCaseIds: Array.isArray(historyDataPoint.knownTestCaseIds) ? historyDataPoint.knownTestCaseIds : [],
  testResults: normalizeHistoryTestResults(historyDataPoint.testResults),
  metrics: normalizeHistoryMetrics(historyDataPoint.metrics),
  url: historyDataPoint.url ?? "",
});

export const normalizeHistoryDataPointUrls = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => {
  const normalizedHistoryDataPoint = normalizeHistoryDataPoint(historyDataPoint);
  const { url } = normalizedHistoryDataPoint;

  if (!url) {
    return normalizedHistoryDataPoint;
  }

  let testResults = normalizedHistoryDataPoint.testResults;

  for (const [historyId, historyTestResult] of Object.entries(normalizedHistoryDataPoint.testResults)) {
    if (historyTestResult.url) {
      continue;
    }

    if (testResults === normalizedHistoryDataPoint.testResults) {
      testResults = { ...normalizedHistoryDataPoint.testResults };
    }

    testResults[historyId] = {
      ...historyTestResult,
      url,
    };
  }

  if (testResults === normalizedHistoryDataPoint.testResults) {
    return normalizedHistoryDataPoint;
  }

  return {
    ...normalizedHistoryDataPoint,
    testResults,
  };
};

export const selectHistoryTestResults = (
  historyDataPoints: HistoryDataPoint[],
  historyIdCandidates: readonly string[],
): HistoryTestResult[] => {
  if (historyIdCandidates.length === 0) {
    return [];
  }

  return historyDataPoints.reduce((acc, historyDataPoint) => {
    for (const historyId of historyIdCandidates) {
      const historyTestResult = historyDataPoint.testResults?.[historyId];

      if (!historyTestResult) {
        continue;
      }

      acc.push(historyTestResult);
      break;
    }

    return acc;
  }, [] as HistoryTestResult[]);
};

/**
 * @description Gets the historical test results for the test result.
 * @param hdps - The history data points.
 * @param tr - The test result or history test result.
 * @returns The history test results array.
 */
export const htrsByTr = (hdps: HistoryDataPoint[], tr: TestResult | HistoryTestResult): HistoryTestResult[] => {
  if (!tr?.historyId) {
    return [];
  }

  return selectHistoryTestResults(hdps, [tr.historyId]);
};
