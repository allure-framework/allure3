import type { MetricSample, TestResult } from "@allurereport/core-api";

export type QualityGateValidationResult = {
  success: boolean;
  expected: any;
  actual: any;
  rule: string;
  message: string;
  environment?: string;
  testResults: string[];
};

export type QualityGateRules = Record<string, any> & {
  /**
   * Ruleset identifier to make it possible to visually divide same rules
   */
  id?: string;
  fastFail?: boolean;
  filter?: (tr: TestResult) => boolean;
};

export type QualityGateRuleResult<T = unknown> = {
  success: boolean;
  actual: T;
  testResults: string[];
};

export interface QualityGateRuleState {
  getResult(): unknown;
  setResult(value: unknown, testResults: string[]): void;
}

export type QualityGateMetricHistoryPoint = {
  uuid?: string;
  timestamp?: number;
  metrics?: Record<string, number>;
};

export type QualityGateRule<T = unknown, K = T> = {
  rule: string;
  message: (payload: { expected: T; actual: K }) => string;
  /**
   * Message which is used when the rule has been passed.
   * When it's not provided, a generic message is generated instead.
   */
  successMessage?: (payload: { expected: T; actual: K }) => string;
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    state: QualityGateRuleState;
    metrics?: MetricSample[];
    previousHistory?: QualityGateMetricHistoryPoint[];
    environment?: string;
  }) => Promise<QualityGateRuleResult<K>>;
};

// Registry callbacks accept independently typed rules while inline callbacks
// still receive unknown values. Individual QualityGateRule<T, K> retains its input/result types.
interface RegisteredQualityGateRule {
  rule: string;
  message(this: void, ...args: Parameters<QualityGateRule["message"]>): string;
  successMessage?(this: void, ...args: Parameters<NonNullable<QualityGateRule["successMessage"]>>): string;
  validate(this: void, ...args: Parameters<QualityGateRule["validate"]>): ReturnType<QualityGateRule["validate"]>;
}

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: RegisteredQualityGateRule[];
};
