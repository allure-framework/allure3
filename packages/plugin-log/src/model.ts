import type { TestResult } from "@allurereport/core-api";
import type { QualityGateValidationResult } from "@allurereport/plugin-api";

export type LogPluginOptions = {
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suite" | "feature" | "package" | "suites" | "features" | "packages" | "none";
  qualityGateResults?: boolean;
  qualityGateFilter?: (result: QualityGateValidationResult) => boolean;
  filter?: (testResult: TestResult) => boolean;
};
