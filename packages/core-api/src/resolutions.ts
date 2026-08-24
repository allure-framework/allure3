import type { TestError, TestStatus } from "./model.js";

export type ResolutionCategory = "issue" | "muted" | "accepted";

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
  id: string;
  category: "issue";
  issue: { id: string; type: string };
  comment?: string;
}

export interface IgnoredResolutionRule extends ResolutionMatcher {
  category: "muted" | "accepted";
  comment: string;
}

export type ResolutionRule = IssueResolutionRule | IgnoredResolutionRule;

export interface ResolutionsConfig {
  knownIssuesPath?: string;
  links?: Record<string, ResolutionLinkTemplate>;
  rules: ResolutionRule[];
}

export interface ResolutionIssue {
  id: string;
  issue: { id: string; type: string };
  comment?: string;
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
