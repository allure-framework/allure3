import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import type {
  IgnoredResolutionRule,
  IssueResolutionRule,
  KnownIssueRecord,
  KnownIssuesFile,
  ResolutionLinkTemplate,
  ResolutionRule,
  ResolutionsConfig,
  TestResult,
} from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";

import { isFileNotFoundError } from "./utils/misc.js";

export const DEFAULT_KNOWN_ISSUES_PATH = "known-issues.json";

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const validateStringList = (value: unknown, path: string, errors: string[]) => {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !nonEmpty(entry))) {
    errors.push(`${path} must be a non-empty array of non-empty strings`);
  }
};

const placeholderCount = (value: unknown) => (typeof value === "string" ? (value.match(/%s/g)?.length ?? 0) : 0);

const validateLinkTemplate = (type: string, template: ResolutionLinkTemplate, errors: string[]) => {
  if (!nonEmpty(type)) {
    errors.push("resolutions.links keys must be non-empty strings");
  }

  if (!nonEmpty(template?.urlTemplate) || placeholderCount(template.urlTemplate) !== 1) {
    errors.push(`resolutions.links.${type}.urlTemplate must contain exactly one %s`);
  }

  if (template?.nameTemplate === undefined) {
    return;
  }

  if (!nonEmpty(template.nameTemplate) || placeholderCount(template.nameTemplate) !== 1) {
    errors.push(`resolutions.links.${type}.nameTemplate must contain exactly one %s`);
  }
};

const validateMessageRegexp = (value: string | undefined, path: string, errors: string[]) => {
  if (value === undefined) {
    return;
  }

  try {
    new RegExp(value);
  } catch {
    errors.push(`${path}.messageRegexp must be a valid regular expression`);
  }
};

const validateMatcher = (matcher: ResolutionRule, path: string, errors: string[]) => {
  validateStringList(matcher.testCaseId, `${path}.testCaseId`, errors);
  validateStringList(matcher.retryHash, `${path}.retryHash`, errors);
  validateStringList(matcher.environment, `${path}.environment`, errors);

  if (
    ![matcher.messageRegexp, matcher.testCaseId, matcher.retryHash, matcher.environment].some(
      (value) => value !== undefined,
    )
  ) {
    errors.push(`${path} must contain at least one matcher`);
  }

  validateMessageRegexp(matcher.messageRegexp, path, errors);
};

const validateIssueUrl = (rule: IssueResolutionRule, template: ResolutionLinkTemplate, errors: string[]) => {
  if (!nonEmpty(template.urlTemplate) || placeholderCount(template.urlTemplate) !== 1) {
    return;
  }

  let url: URL;

  try {
    url = new URL(template.urlTemplate.replace("%s", encodeURIComponent(rule.issue.id)));
  } catch {
    errors.push(`resolutions.links.${rule.issue.type}.urlTemplate must resolve to an absolute URL`);
    return;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    errors.push(`resolutions.links.${rule.issue.type}.urlTemplate must resolve to an HTTP(S) URL`);
  }
};

const validateIssueRule = (
  rule: IssueResolutionRule,
  path: string,
  config: ResolutionsConfig,
  issueIds: Set<string>,
  errors: string[],
) => {
  if (!nonEmpty(rule.issue?.id) || !nonEmpty(rule.issue?.type)) {
    errors.push(`${path}.issue.id and ${path}.issue.type must be non-empty strings`);
    return;
  }

  if (issueIds.has(rule.issue.id)) {
    errors.push(`${path}.issue.id must be unique`);
  }

  issueIds.add(rule.issue.id);

  const template = config.links?.[rule.issue.type];

  if (!template) {
    errors.push(`${path}.issue.type must reference resolutions.links`);
    return;
  }

  validateIssueUrl(rule, template, errors);
};

const validateIgnoredRule = (rule: IgnoredResolutionRule, path: string, errors: string[]) => {
  if (!nonEmpty(rule.comment)) {
    errors.push(`${path}.comment must be a non-empty string`);
  }
};

export const validateResolutionsConfig = (config?: ResolutionsConfig): void => {
  if (!config) {
    return;
  }

  const errors: string[] = [];

  if (!Array.isArray(config.rules)) {
    throw new Error("The provided resolutions config is invalid: resolutions.rules must be an array");
  }

  for (const [type, template] of Object.entries(config.links ?? {})) {
    validateLinkTemplate(type, template, errors);
  }

  const issueIds = new Set<string>();

  config.rules.forEach((rule, index) => {
    const path = `resolutions.rules[${index}]`;
    const matcher = rule as ResolutionRule;

    validateMatcher(matcher, path, errors);

    if (matcher.resolution === "issue") {
      validateIssueRule(matcher, path, config, issueIds, errors);
      return;
    }

    if (matcher.resolution === "muted" || matcher.resolution === "accepted") {
      validateIgnoredRule(matcher, path, errors);
      return;
    }

    errors.push(`${path}.resolution must be issue, muted, or accepted`);
  });

  if (errors.length > 0) {
    throw new Error(`The provided resolutions config is invalid: ${errors.join("; ")}`);
  }
};

const matches = (rule: ResolutionRule, testResult: TestResult): boolean => {
  const { id, allureId, externalId } = testResult.testCase ?? {};
  const testCaseIds = [id, allureId, externalId].filter((value): value is string => typeof value === "string");

  return (
    (!rule.messageRegexp || new RegExp(rule.messageRegexp).test(testResult.error?.message ?? "")) &&
    (!rule.testCaseId || rule.testCaseId.some((id) => testCaseIds.includes(id))) &&
    (!rule.retryHash || (!!testResult.retryHash && rule.retryHash.includes(testResult.retryHash))) &&
    (!rule.environment || (!!testResult.environment && rule.environment.includes(testResult.environment)))
  );
};

export const getResolutionByRules = (
  testResult: TestResult,
  config?: ResolutionsConfig,
): ResolutionRule | undefined => {
  if ((testResult.status !== "failed" && testResult.status !== "broken") || !config?.rules.length) {
    return undefined;
  }

  return config.rules.find((rule) => matches(rule, testResult));
};

export const isIgnoredFailure = (testResult: TestResult): boolean =>
  testResult.resolution === "muted" || testResult.resolution === "accepted";

export const resolveExactIssuesFilePath = async (pathOrDir: string | undefined, label: string) => {
  if (!pathOrDir) return undefined;

  const path = resolve(pathOrDir);

  if (extname(path).toLowerCase() !== ".json") {
    throw new Error(`Invalid ${label} path ${JSON.stringify(pathOrDir)}: expected exact .json file path`);
  }

  try {
    if ((await stat(path)).isDirectory()) {
      throw new Error(`Invalid ${label} path ${JSON.stringify(pathOrDir)}: expected file, got directory`);
    }
  } catch (e) {
    if (!isFileNotFoundError(e)) throw e;
  }
  return path;
};

export const writeKnownIssues = async (store: AllureStore, knownIssuesPath?: string) => {
  const path = await resolveExactIssuesFilePath(knownIssuesPath, "known issues");

  if (!path) return;

  const records = new Map<string, KnownIssueRecord>();

  for (const testResult of await store.allTestResults()) {
    if (testResult.resolution !== "issue" || testResult.isRetry || !testResult.retryHash) {
      continue;
    }

    const issue = await store.resolutionIssueByTestResultId(testResult.id);

    if (!issue || (testResult.status !== "failed" && testResult.status !== "broken")) {
      continue;
    }

    const record = records.get(issue.id) ?? { ...issue, testResults: {} };

    record.testResults[testResult.retryHash] = {
      name: testResult.name,
      fullName: testResult.fullName,
      environment: testResult.environment,
      status: testResult.status,
      error: testResult.error,
    };
    records.set(issue.id, record);
  }

  const file: KnownIssuesFile = { resolutionIssues: [...records.values()].sort((a, b) => a.id.localeCompare(b.id)) };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(file)}\n`, "utf-8");
};
