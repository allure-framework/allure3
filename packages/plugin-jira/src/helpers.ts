import { type TestResult } from "@allurereport/core-api";
import { type ForgePluginTestResult } from "./types.js";

/**
 * Check if URL matches Jira pattern:
 * https://<instance-name>.atlassian.net/browse/<project-key>-<number>
 */
const isJiraUrl = (url: string): boolean => {
  const jiraPattern = /^https:\/\/[a-zA-Z0-9-]+\.atlassian\.net\/browse\/[A-Z]+-\d+$/;

  return jiraPattern.test(url);
};

export const isJiraIssueKey = (issue: string): boolean => {
  const jiraPattern = /^[A-Z]+-\d+$/;
  return jiraPattern.test(issue);
};

export const findJiraLink = (tr: TestResult) => {
  return tr.links.find((link) => isJiraUrl(link.url));
};

export const prepareTestResults = (trs: TestResult[]): ForgePluginTestResult[] => {
  const trMap: Record<string, ForgePluginTestResult> = {};

  for (const tr of trs) {
    const jiraLink = findJiraLink(tr);

    if (!jiraLink) {
      continue;
    }

    const trId = tr.historyId ?? tr.id;

    let trFromMap = trMap[trId];

    if (!trFromMap) {
      trFromMap = trMap[trId] = {
        id: trId,
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
