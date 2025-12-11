import { isDefined } from "@allurereport/reader-api";
import type { RawTestStatus } from "@allurereport/reader-api";
import type { Suite } from "./model.js";

/**
 * This function allows to ignore suites that are not parents of a new one. Eventually, it will filter out all suites
 * that doesn't exist in the test's URI. This is necessary for some tests (e.g., UI XCTests) where extra suites are
 * created, which doesn't exist in the source code.
 */
export const withNewSuite = (suites: readonly Suite[], id: string, uri: string | undefined, name: string) => {
  return [...suites.filter(({ uri: parentUri }) => !parentUri || !uri || uri.startsWith(parentUri)), { id, uri, name }];
};

export const getTestClassFromSuites = (suites: readonly Suite[]) => suites.map(({ id }) => id).join(".");

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
  if (filename === "/<compiler-generated>") {
    return undefined;
  }

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
