import {
  type TestLabel,
  type TestParameter,
  fallbackTestCaseIdLabelName,
  findLastByLabelName,
} from "@allurereport/core-api";

import { md5 } from "./misc.js";

type TestResultLike = {
  historyId?: string;
  labels?: TestLabel[];
  parameters?: TestParameter[];
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

export const getFallbackHistoryId = (tr: Pick<TestResultLike, "labels" | "parameters">): string | undefined => {
  const fallbackTestCaseId = findLastByLabelName(tr.labels ?? [], fallbackTestCaseIdLabelName);

  if (!fallbackTestCaseId) {
    return undefined;
  }

  return `${fallbackTestCaseId}.${md5(stringifyHistoryParams(tr.parameters ?? []))}`;
};

export const getHistoryIdCandidates = (tr: TestResultLike): string[] => {
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
