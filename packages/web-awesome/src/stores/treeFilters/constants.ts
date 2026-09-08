import type { ResolutionCategory, TestStatus, TestStatusTransition } from "@allurereport/core-api";

export const TRANSITIONS: TestStatusTransition[] = ["new", "fixed", "regressed", "malfunctioned"];
export const STATUSES: TestStatus[] = ["passed", "failed", "skipped", "broken", "unknown"];
export const RESOLUTIONS: ResolutionCategory[] = ["issue", "muted", "accepted"];

export const PARAMS = {
  QUERY: "query",
  STATUS: "status",
  FLAKY: "flaky",
  RETRY: "retry",
  RESOLUTION: "resolution",
  TRANSITION: "transition",
  TAGS: "tags",
  CATEGORIES: "categories",
} as const;
