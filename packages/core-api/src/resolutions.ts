import type { TestLink } from "./metadata.js";
import type { TestError, TestResult, TestStatus } from "./model.js";

export type ResolutionCategory = "issue" | "muted" | "accepted";
export type MutedResolutionState = "active" | "outdated" | "permanent";

export interface ResolutionLinkTemplate {
  nameTemplate?: string;
  urlTemplate: string;
}

export interface ResolutionMatcher {
  messageRegexp?: string;
  testCaseId?: string[];
  retryHash?: string[];
  environment?: string[];
}

export interface IssueResolutionRule extends ResolutionMatcher {
  resolution: "issue";
  issue: { id: string; type: string };
  comment?: string;
}

export interface IgnoredResolutionRule extends ResolutionMatcher {
  resolution: "muted" | "accepted";
  comment: string;
  /**
   * JavaScript-compatible ISO 8601 timestamp with an explicit timezone. The mute
   * is active strictly before this instant and outdated at or after it. If omitted,
   * the mute is permanent.
   * Only supported when `resolution` is `"muted"`.
   */
  expiresAt?: string;
}

export interface MutedResolutionRule extends IgnoredResolutionRule {
  resolution: "muted";
}

export interface AcceptedResolutionRule extends IgnoredResolutionRule {
  resolution: "accepted";
}

export type ResolutionRule = IssueResolutionRule | IgnoredResolutionRule;

type ResolutionStateSource = Pick<TestResult, "resolution" | "resolutionExpiresAt">;

export const parseResolutionExpiresAt = (value: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);

  if (!match) {
    return undefined;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, offsetHour, offsetMinute] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

  if (
    year <= 0 ||
    daysInMonth === undefined ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))
  ) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : undefined;
};

export const getMutedResolutionState = (
  testResult: ResolutionStateSource,
  now = Date.now(),
): MutedResolutionState | undefined => {
  if (testResult.resolution !== "muted") {
    return undefined;
  }

  if (testResult.resolutionExpiresAt === undefined) {
    return "permanent";
  }

  const expiresAt = parseResolutionExpiresAt(testResult.resolutionExpiresAt);

  return expiresAt === undefined || now >= expiresAt ? "outdated" : "active";
};

export const isIgnoredResolution = (testResult: ResolutionStateSource, now = Date.now()): boolean =>
  testResult.resolution === "accepted" ||
  (testResult.resolution === "muted" && getMutedResolutionState(testResult, now) !== "outdated");

export interface ResolutionsConfig {
  knownIssuesPath?: string;
  links?: Record<string, ResolutionLinkTemplate>;
  rules: ResolutionRule[];
}

export interface ResolutionIssue {
  id: string;
  type: string;
  comment?: string;
  link?: TestLink;
}

export interface KnownIssueTestResult {
  name: string;
  fullName?: string;
  environment?: string;
  status: Extract<TestStatus, "failed" | "broken">;
  error?: TestError;
}

export interface KnownIssueRecord extends ResolutionIssue {
  testResults: Record<string, KnownIssueTestResult>;
}

export interface KnownIssuesFile {
  resolutionIssues: KnownIssueRecord[];
}
