import type { TestStatus } from "@allurereport/core-api";
import type { Direction, SortBy, SortByField, Transition } from "./types.js";

export const DEFAULT_SORT_BY: SortBy = "order,asc";
export const TRANSITIONS: Transition[] = ["new", "fixed", "regressed", "malfunctioned"];
export const SORT_BY_FIELDS: SortByField[] = ["order", "duration", "status", "name"];
export const DIRECTIONS: Direction[] = ["asc", "desc"];
export const STATUSES: TestStatus[] = ["passed", "failed", "skipped", "broken", "unknown"];
export const SORT_BY_STORAGE_KEY = "ALLURE_REPORT_SORT_BY";

export const PARAMS = {
  QUERY: "query",
  STATUS: "status",
  FLAKY: "flaky",
  RETRY: "retry",
  TRANSITION: "transition",
  TAGS: "tags",
  SORT_BY: "sortBy",
} as const;
