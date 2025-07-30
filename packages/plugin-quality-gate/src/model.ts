import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, QualityGateValidationResult } from "@allurereport/plugin-api";

export type QualityGateRules = Record<string, any> & {
  /**
   * Ruleset identifier to make it possible to visually divide same rules
   */
  id?: string;
  filter?: (tr: TestResult) => boolean;
};

export enum QualityGateRuleMode {
  Relative = "relative",
  Absolute = "absolute",
}

export type QualityGateContext = {
  rulesState: Record<string, any>;
  store?: AllureStore;
}

export type QualityGateRuleContext = QualityGateContext & {
  state: any;
  id?: string;
  filter?: (tr: TestResult) => boolean;
}

export type QualityGateRule = {
  rule: string;
  mode: QualityGateRuleMode;
  message: (payload: { expected: any; actual: any }) => string;
  validate: (trs: TestResult[], expected: any, context: QualityGateRuleContext) => Promise<Pick<QualityGateValidationResult, "success" | "actual" | "expected">>;
};

export type QualityGateRuleOptions = {
  trFilter?: (tr: TestResult) => boolean;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};

export type QualityGatePluginOptions = {
  rules: QualityGateRules[];
  use?: QualityGateRule[];
  fastFail?: boolean;
};
