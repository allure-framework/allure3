import type { TestError } from "@allurereport/core-api";

export type TestErrorLike = Pick<TestError, "message" | "trace" | "actual" | "expected">;

// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

/**
 * Error text without ANSI escape sequences and surrounding whitespace, or an empty string for non-strings.
 */
export const normalizeErrorText = (value?: string) =>
  typeof value === "string" ? value.replace(ansiRegex, "").trim() : "";

/**
 * Both sides of the comparison are present; adapters serialize a missing side as "undefined".
 */
export const hasErrorDiff = (error?: TestErrorLike) =>
  Boolean(error?.actual) &&
  error?.actual !== "undefined" &&
  Boolean(error?.expected) &&
  error?.expected !== "undefined";

export const isDisplayableTestError = (error?: TestErrorLike) =>
  Boolean(normalizeErrorText(error?.message)) || Boolean(normalizeErrorText(error?.trace)) || hasErrorDiff(error);
