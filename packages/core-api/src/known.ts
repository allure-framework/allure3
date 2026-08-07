import type { TestLink } from "./metadata.js";
import type { TestError } from "./model.js";

export interface KnownIssueDecision {
  reason: string;
  links?: TestLink[];
}

export interface KnownTestFailure extends KnownIssueDecision {
  historyId: string;
  error?: TestError;
}

export interface KnownIssueDescriptor {
  messageRegexp?: string;
  testCaseId?: string;
  retryHash?: string;
  environmentId?: string;
  decision: KnownIssueDecision;
}

export interface KnownIssuesConfig {
  rules: KnownIssueDescriptor[];
}
