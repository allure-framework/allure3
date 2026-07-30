import type {
  HistoryDataPoint,
  MetricSample,
  PerformanceConfig,
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
  message: (payload: { expected: T; actual: any; performance?: PerformanceConfig }) => string;
  validate: (payload: {
    expected: T;
    trs: TestResult[];
    state: QualityGateRuleState<K>;
    metrics?: MetricSample[];
    history?: HistoryDataPoint[];
    performance?: PerformanceConfig;
    environment?: string;
    currentReportUuid?: string;
    complete?: boolean;
  }) => Promise<QualityGateRuleResult>;
};

export type QualityGateConfig = {
  rules?: QualityGateRules[];
  use?: QualityGateRule[];
};
