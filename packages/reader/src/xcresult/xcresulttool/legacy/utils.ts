import type { RawTestStatus } from "@allurereport/reader-api";
import { isDefined } from "../../../validation.js";
import type { Suite } from "./model.js";

export const withNewSuite = (suites: Suite[], uri: string | undefined, name: string) => {
  return [...suites.filter(({ uri: parentUri }) => !parentUri || !uri || uri.startsWith(parentUri)), { uri, name }];
};

export const resolveTestStatus = (
  status: string | undefined,
  worstStepStatus: RawTestStatus | undefined,
): RawTestStatus => {
  switch (status) {
    case "Success":
    case "Expected Failure":
      return "passed";
    case "Failure":
      return worstStepStatus === "broken" ? "broken" : "failed";
    case "Skipped":
      return "skipped";
    default:
      return "unknown";
  }
};

export const resolveFailureStepStatus = (issueType: string | undefined): RawTestStatus =>
  issueType === "Thrown Error" ? "broken" : "failed";

export const convertTraceLine = (
  symbolName: string | undefined,
  filename: string | undefined,
  line: number | undefined,
) => {
  const symbolPart = symbolName ? `In ${symbolName}` : undefined;
  const locationPart = filename && isDefined(line) ? `${filename}:${line}` : filename;
  return symbolPart
    ? locationPart
      ? `${symbolName} at ${locationPart}`
      : symbolPart
    : locationPart
      ? `At ${locationPart}`
      : undefined;
};
