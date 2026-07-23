import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import type { KnownTestFailure, QuarantineTestFailure, TestStatus } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";

import { isFileNotFoundError } from "./utils/misc.js";

const failedStatuses: Set<TestStatus> = new Set(["failed", "broken"]);

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

export const readQuarantine = async (quarantinePath: string): Promise<QuarantineTestFailure[]> => {
  const path = await resolveExactIssuesFilePath(quarantinePath, "quarantine");

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

export const writeKnownIssues = async (store: AllureStore, knownIssuesPath?: string) => {
  const path = await resolveExactIssuesFilePath(knownIssuesPath, "known issues");

  if (!path) {
    return;
  }

  const testResults = await store.allTestResults();
  const knownIssues: KnownTestFailure[] = testResults
    .filter((tr) => failedStatuses.has(tr.status))
    .filter((tr) => tr.historyId)
    .map(({ historyId, links }) => ({
      historyId: historyId!,
      issues: links.filter((l) => l.type === "issue"),
      comment: "automatically generated from failure by allure known-issue command",
    }));

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(knownIssues)}\n`, "utf-8");
};

export const writeQuarantine = async (store: AllureStore, knownIssuesPath?: string) => {
  const path = await resolveExactIssuesFilePath(knownIssuesPath, "quarantine");

  if (!path) {
    return;
  }

  const quarantineIssues = await store.quarantineIssues();

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(quarantineIssues)}\n`, "utf-8");
};
