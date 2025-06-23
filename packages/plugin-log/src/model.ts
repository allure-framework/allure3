import type { TestResult } from "@allurereport/core-api";

export type LogPluginOptions = {
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suites" | "features" | "packages" | "none";
  filter?: (testResult: TestResult) => boolean;
};
