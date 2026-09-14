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
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    state: QualityGateRuleState;
    metrics?: MetricSample[];
    previousHistory?: QualityGateMetricHistoryPoint[];
    environment?: string;
  }) => Promise<QualityGateRuleResult<K>>;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
