import type { KnownTestFailure, TestResult } from "@allurereport/core-api";

export type QualityGateValidationResult = {
  success: boolean;
  expected: any;
  actual: any;
  rule: string;
  message: string;
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
  expected: any;
  actual: any;
};

export type QualityGateRule<T = any> = {
  rule: string;
  message: (payload: { expected: T; actual: T }) => string;
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    knownIssues: KnownTestFailure[];
    state?: T;
  }) => Promise<QualityGateRuleResult>;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
