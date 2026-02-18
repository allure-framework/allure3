import type { KnownTestFailure, TestResult } from "@allurereport/core-api";

export type QualityGateValidationResult = {
  success: boolean;
  expected: any;
  actual: any;
  rule: string;
  message: string;
  environment?: string;
};

export type QualityGateRules = Record<string, any> & {
  /**
   * Ruleset identifier to make it possible to visually divide same rules
   */
  id?: string;
  fastFail?: boolean;
  filter?: (tr: TestResult) => boolean;
};

export type QualityGateRuleResult = {
  success: boolean;
  actual: any;
};

export interface QualityGateRuleState<T> {
  getResult(): T | undefined;
  setResult(value: T): void;
}

export type QualityGateRule<T = any, K = T> = {
  rule: string;
  message: (payload: { expected: T; actual: T }) => string;
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    knownIssues: KnownTestFailure[];
    state: QualityGateRuleState<K>;
    environment?: string;
  }) => Promise<QualityGateRuleResult>;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
