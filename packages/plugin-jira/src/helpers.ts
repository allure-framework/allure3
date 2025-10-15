import { DEFAULT_ENVIRONMENT, type TestParameter, type TestResult } from "@allurereport/core-api";
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

/**
 * Filter key parameters to keep only the ones that are shared between all
 * environment-specific runs of the same test
 */
const filterKeyParams = (params: TestParameter[], runsCount: number) => {
  const result: Pick<TestParameter, "name" | "value">[] = [];

  const intermediate = new Map<TestParameter["name"], { value: TestParameter["value"]; count: number }>();

  for (const p of params) {
    if (p.excluded || p.hidden) {
      continue;
    }

    if (!intermediate.has(p.name)) {
      intermediate.set(p.name, { value: p.value, count: 1 });
      continue;
    }

    if (intermediate.get(p.name)!.value !== p.value) {
      intermediate.delete(p.name);
      continue;
    }

    intermediate.get(p.name)!.count++;
  }

  for (const [name, value] of intermediate) {
    if (value.count === runsCount) {
      result.push({ name, value: value.value });
      continue;
    }
  }

  return result;
};

const filterOutDefaultEnvironment = (env?: string): string | undefined => {
  if (env === DEFAULT_ENVIRONMENT) {
    return undefined;
  }

  return env;
};

export const prepareTestResults = (trs: TestResult[]): ForgePluginTestResult[] => {
  const trMap = new Map<string, ForgePluginTestResult>();

  for (const tr of trs) {
    const jiraLink = findJiraLink(tr);

    if (!jiraLink) {
      continue;
    }

    const trId = tr.historyId ?? tr.id;

    if (!trMap.has(trId)) {
      trMap.set(trId, {
        id: trId,
        entries: [],
        issue: jiraLink,
        name: trimName(tr.name),
        keyParams: [],
      });
    }

    const storedTr = trMap.get(trId)!;

    // aggregate evironment-specific entries of same test
    storedTr.entries.push({ status: tr.status, env: filterOutDefaultEnvironment(tr.environment), date: tr.stop! });
    storedTr.keyParams.push(...tr.parameters);
  }

  return Array.from(trMap.values()).map((tr) => {
    return {
      ...tr,
      keyParams: filterKeyParams(tr.keyParams as TestParameter[], tr.entries.length),
    };
  });
};

const trimStrMax = (str: string, maxLength: number = 255): string => {
  if (str.length <= maxLength) {
    return str;
  }

  const trimmed = str.slice(0, maxLength);

  // Remove any trailing dots and add our ellipsis
  return `${trimmed.replace(/\.+$/, "")}...`;
};

export const trimName = (name: string) => trimStrMax(name, 255);
export const trimParameters = (p: string) => trimStrMax(p, 120);
export const trimCiInfoLabel = (label: string) => trimStrMax(label, 120);
