import type {
  HistoryDataPoint,
  MetricSample,
  TestResult,
} from "@allurereport/core-api";

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

export type QualityGateRuleResult = {
  success: boolean;
  actual: any;
  testResults: string[];
};

export interface QualityGateRuleState<T> {
  getResult(): T | undefined;
  setResult(value: T, testResults: QualityGateRuleResult["testResults"]): void;
}

export type QualityGateRule<T = any, K = T> = {
  rule: string;
  message: (payload: { expected: T; actual: any }) => string;
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    state: QualityGateRuleState<K>;
    metrics?: MetricSample[];
    previousHistory?: HistoryDataPoint[];
    environment?: string;
  }) => Promise<QualityGateRuleResult>;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
