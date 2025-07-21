import type { TestResult } from "@allurereport/core-api";
import type { AllureStore } from "./store.js";

export type QualityGateRules = Record<string, any> & {
  id?: string;
  filter?: (tr: TestResult) => boolean;
};

export type QualityGateRuleResult = {
  success: boolean;
  expected: any;
  actual: any;
};

export type QualityGateRule = {
  rule: string;
  message: (payload: { expected: any, actual: any }) => string;
  validate: (expected: any, store: AllureStore, options?: QualityGateRuleOptions) => Promise<QualityGateRuleResult>;
};

export type QualityGateValidationResult = QualityGateRuleResult & Pick<QualityGateRule, "rule"> & {
  message: string;
};

export type QualityGateRuleOptions = {
  trFilter?: (tr: TestResult) => boolean;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
