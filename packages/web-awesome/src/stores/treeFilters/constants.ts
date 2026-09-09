import {
  type ResolutionCategory,
  type TestStatus,
  type TestStatusTransition,
  severityLevels,
} from "@allurereport/core-api";

export const TRANSITIONS: TestStatusTransition[] = ["new", "fixed", "regressed", "malfunctioned"];
export const STATUSES: TestStatus[] = ["passed", "failed", "skipped", "broken", "unknown"];
export const RESOLUTIONS: ResolutionCategory[] = ["issue", "muted", "accepted"];

/**
 * Option key of the "no severity" filter choice. It only exists in the UI and in the URL:
 * tree leaves of test results without a severity label don't carry the property at all.
 */
export const NO_SEVERITY = "none";

export const SEVERITIES: string[] = [...severityLevels, NO_SEVERITY];

export const PARAMS = {
  QUERY: "query",
  STATUS: "status",
  FLAKY: "flaky",
  RETRY: "retry",
  RESOLUTION: "resolution",
  TRANSITION: "transition",
  TAGS: "tags",
  CATEGORIES: "categories",
  SEVERITY: "severity",
} as const;
