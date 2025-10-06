import { type TestResult } from "@allurereport/core-api";
import { type ForgePluginTestResult } from "./types.js";

export const findJiraLink = (tr: TestResult) => {
  return tr.links.find((link) => {
    if (link.type !== "issue") {
      return false;
    }

    if (!link.name) {
      return false;
    }

    const linknamesplit = link.name.split("-");

    if (linknamesplit.length !== 2) {
      return false;
    }

    const [, issue] = linknamesplit;

    if (isNaN(parseInt(issue, 10))) {
      return false;
    }

    return true;
  });
};

export const prepareTestResults = (trs: TestResult[]): ForgePluginTestResult[] => {
  const trMap: Record<string, ForgePluginTestResult> = {};

  for (const tr of trs) {
    const jiraLink = findJiraLink(tr);

    if (!jiraLink) {
      continue;
    }

    const historyId = tr.historyId!;

    const trFromMap = trMap[historyId];

    if (!trFromMap) {
      trMap[historyId] = {
        id: historyId,
        runs: [],
        issue: jiraLink,
        name: tr.name,
        keyParams: tr.parameters.filter((p) => !p.excluded && !p.hidden),
      };
    }

    trFromMap.runs.push({ status: tr.status, env: tr.environment, date: tr.stop! });
  }

  return Object.values(trMap);
};
