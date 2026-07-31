import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import type { KnownIssueDescriptor, KnownIssuesConfig, KnownTestFailure, TestResult } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";

import { isFileNotFoundError } from "./utils/misc.js";

export const DEFAULT_KNOWN_ISSUES_PATH = "known-issues.json";

export const hasKnownIssueRules = (knownIssues?: KnownIssuesConfig): boolean => (knownIssues?.rules?.length ?? 0) > 0;

const messageMatches = (rule: KnownIssueDescriptor, testResult: TestResult): boolean => {
  if (!rule.messageRegexp) {
    return true;
  }

  const message = testResult.error?.message;

  return typeof message === "string" && new RegExp(rule.messageRegexp).test(message);
};

const testCaseMatches = (rule: KnownIssueDescriptor, testResult: TestResult): boolean => {
  return !rule.testCaseId || rule.testCaseId === testResult.testCase?.id;
};

const environmentMatches = (rule: KnownIssueDescriptor, environmentId?: string): boolean => {
  return !rule.environmentId || rule.environmentId === environmentId;
};

export const getKnownIssueByRules = (
  testResult: TestResult,
  knownIssues: KnownIssuesConfig | undefined,
  environmentId?: string,
): KnownTestFailure | undefined => {
  if (!testResult.historyId || !hasKnownIssueRules(knownIssues)) {
    return undefined;
  }

  const rule = knownIssues!.rules.find(
    (item) =>
      messageMatches(item, testResult) && testCaseMatches(item, testResult) && environmentMatches(item, environmentId),
  );

  if (!rule) {
    return undefined;
  }

  return {
    historyId: testResult.historyId,
    reason: rule.decision.reason,
    links: rule.decision.links,
    error: testResult.error,
  };
};

export const resolveExactIssuesFilePath = async (pathOrDir: string | undefined, label: string) => {
  if (!pathOrDir) {
    return undefined;
  }

  const path = resolve(pathOrDir);

  if (extname(path).toLowerCase() !== ".json") {
    throw new Error(`Invalid ${label} path ${JSON.stringify(pathOrDir)}: expected exact .json file path`);
  }

  try {
    const pathStats = await stat(path);

    if (pathStats.isDirectory()) {
      throw new Error(`Invalid ${label} path ${JSON.stringify(pathOrDir)}: expected file, got directory`);
    }
  } catch (e) {
    if (!isFileNotFoundError(e)) {
      throw e;
    }
  }

  return path;
};

export const readKnownIssues = async (knownIssuePath: string): Promise<KnownTestFailure[]> => {
  const path = await resolveExactIssuesFilePath(knownIssuePath, "known issues");

  if (!path) {
    return [];
  }

  try {
    const content = await readFile(path, { encoding: "utf-8" });

    return JSON.parse(content);
  } catch (e) {
    if (isFileNotFoundError(e)) {
      return [];
    }

    throw e;
  }
};

const writeKnownIssueRecords = async (knownIssues: KnownTestFailure[], knownIssuesPath?: string) => {
  const path = await resolveExactIssuesFilePath(knownIssuesPath, "known issues");

  if (!path) {
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(knownIssues)}\n`, "utf-8");
};

export const writeKnownIssues = async (store: AllureStore, knownIssuesPath?: string) => {
  const knownIssues = await store.allKnownIssues();

  await writeKnownIssueRecords(knownIssues, knownIssuesPath);
};
