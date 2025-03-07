import type { KnownTestFailure, TestStatus } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isFileNotFoundError } from "./utils/misc.js";

const failedStatuses: Set<TestStatus> = new Set(["failed", "broken"]);

export const readKnownIssues = async (knownIssuePath: string): Promise<KnownTestFailure[]> => {
  const path = resolve(knownIssuePath);

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
  if (!knownIssuesPath) {
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

  await writeFile(knownIssuesPath, JSON.stringify(knownIssues));
};
