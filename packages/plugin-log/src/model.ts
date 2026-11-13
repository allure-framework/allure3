import type { AllureQualityGateResult, TestResult } from "@allurereport/core-api";

export type LogPluginOptions = {
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suite" | "feature" | "package" | "suites" | "features" | "packages" | "none";
  qualityGateResults?: boolean;
  qualityGateFilter?: (result: AllureQualityGateResult) => boolean;
  filter?: (testResult: TestResult) => boolean;
};
