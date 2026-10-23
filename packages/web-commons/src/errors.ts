import type { TestError } from "@allurereport/core-api";

export const hasErrorDiff = (error?: Pick<TestError, "actual" | "expected">) =>
  !!error?.actual && error.actual !== "undefined" && !!error?.expected && error.expected !== "undefined";
