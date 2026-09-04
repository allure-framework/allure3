import { type TestStatus, type TestStatusTransition, noSeverityValue, severityLevels } from "@allurereport/core-api";

export const TRANSITIONS: TestStatusTransition[] = ["new", "fixed", "regressed", "malfunctioned"];
export const STATUSES: TestStatus[] = ["passed", "failed", "skipped", "broken", "unknown"];
export const SEVERITIES: string[] = [...severityLevels, noSeverityValue];

export const PARAMS = {
  QUERY: "query",
  STATUS: "status",
  FLAKY: "flaky",
  RETRY: "retry",
  TRANSITION: "transition",
  TAGS: "tags",
  CATEGORIES: "categories",
  SEVERITY: "severity",
} as const;
