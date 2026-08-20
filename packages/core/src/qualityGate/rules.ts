import { filterSuccessful, filterUnsuccessful, type MetricSample } from "@allurereport/core-api";
import { type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

type MetricRuleConfig = {
  key: string;
  value: number;
};

type MetricHistoryPoint = {
  uuid?: string;
  timestamp?: number;
  metrics?: Record<string, number>;
};

const metricValues = (metrics: MetricSample[], key: string): number[] =>
  metrics
    .map((metric) => (metric.key === key ? metric.value : undefined))
    .filter((value): value is number => Number.isFinite(value));

const metricAverage = (metrics: MetricSample[], key: string): number | undefined => {
  const values = metricValues(metrics, key);

  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const metricSample = (metrics: MetricSample[] | undefined, key: string) =>
  metrics?.find((metric) => metric.key === key);

const previousMetricValue = (
  history: MetricHistoryPoint[],
  key: string,
  currentReportUuid?: string,
): number | undefined => {
  const previousHistory = [...history]
    .filter(({ uuid }) => uuid !== currentReportUuid)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  for (const historyPoint of previousHistory) {
    const value = historyPoint.metrics?.[key];

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const formatMetricValue = (value: number | undefined, unit?: string) => {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const finiteValue = value as number;
  const formatted = Number.isInteger(finiteValue) ? String(finiteValue) : String(Number(finiteValue.toFixed(3)));

  return unit ? `${formatted} ${unit}` : formatted;
};

const missingMetricResult = () => ({
  success: false,
  actual: undefined,
  testResults: [],
});

const metricRuleResult = (success: boolean, actual: number | undefined) => ({
  success,
  actual,
  testResults: [],
});

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} exceeds the allowed threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? 0;
    const failedTrs = trs.filter(filterUnsuccessful);
    const testResults = failedTrs.map((tr) => tr.id);
    const actual = previous + failedTrs.length;

    state.setResult(actual, testResults);

    return {
      success: actual <= expected,
      actual,
      testResults,
    };
  },
};

export const minTestsCountRule: QualityGateRule<number> = {
  rule: "minTestsCount",
  message: ({ actual, expected }) =>
    `The total number of tests ${bold(String(actual))} is less than the expected threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const actual = trs.length + (state.getResult() ?? 0);

    state.setResult(actual, []);

    return {
      success: actual >= expected,
      actual,
      testResults: [],
    };
  },
};

export const successRateRule: QualityGateRule<number, { totalCount: number; passedCount: number }> = {
  rule: "successRate",
  message: ({ actual, expected }) =>
    `Success rate ${bold(String(actual))} is less, than expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? { totalCount: 0, passedCount: 0 };
    const passedTrs = trs.filter(filterSuccessful);
    const notPassedTrs = trs.filter((tr) => !filterSuccessful(tr));
    const totalCount = previous.totalCount + trs.length;
    const passedCount = previous.passedCount + passedTrs.length;
    const testResults = notPassedTrs.map((tr) => tr.id);
    const rate = totalCount === 0 ? 0 : passedCount / totalCount;

    state.setResult({ totalCount, passedCount }, testResults);

    return {
      success: rate >= expected,
      actual: rate,
      testResults,
    };
  },
};

export const maxDurationRule: QualityGateRule<number> = {
  rule: "maxDuration",
  message: ({ actual, expected }) =>
    `Maximum duration of some tests exceed the defined limit; actual ${bold(String(actual))}, expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? 0;
    const actual = Math.max(previous, ...trs.map((tr) => tr.duration ?? 0));
    const tooLongTrs = trs.filter((tr) => (tr.duration ?? 0) > expected);
    const testResults = tooLongTrs.map((tr) => tr.id);

    state.setResult(actual, testResults);

    return {
      success: actual <= expected,
      actual,
      testResults,
    };
  },
};

/**
 * Fails if any test in the run does not have the given environment.
 * Expected: environment name (string).
 */
export const allTestsContainEnvRule: QualityGateRule<string, number> = {
  rule: "allTestsContainEnv",
  message: ({ actual, expected }) =>
    `Not all tests contain the required "${bold(expected)}" environment, ${bold(actual)} tests have different or missing environment`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? 0;
    const testsWithoutEnv = trs.filter((tr) => (tr.environment ?? "") !== expected);
    const testResults = testsWithoutEnv.map((tr) => tr.id);
    const actual = testsWithoutEnv.length + previous;

    state.setResult(actual, testResults);

    return {
      success: actual === 0,
      actual,
      testResults,
    };
  },
};

/**
 * Fails if the run does not contain at least one test for each of the given environments.
 * Expected: array of environment names (string[]).
 */
export const environmentsTestedRule: QualityGateRule<string[]> = {
  rule: "environmentsTested",
  message: ({ actual, expected }) =>
    `The following environments were not tested: "${actual.join('", "')}"; expected all of: "${expected.join('", "')}"`,
  validate: async ({ trs, expected, state }) => {
    const previouslyTested = new Set(state.getResult() ?? []);
    const batchTested = trs.map((tr) => tr.environment).filter((env): env is string => env != null && env !== "");

    const testedEnvs = new Set([...previouslyTested, ...batchTested]);

    state.setResult([...testedEnvs], []);

    const missing = expected.filter((env) => !testedEnvs.has(env));

    return {
      success: missing.length === 0,
      actual: missing,
      testResults: [],
    };
  },
};

export const metricMaxRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMax",
  message: ({ actual, expected, metrics }) => {
    const metric = metricSample(metrics, expected.key);

    return `${bold(metric?.title ?? expected.key)} ${bold(formatMetricValue(actual, metric?.unit))} exceeds the allowed maximum ${bold(formatMetricValue(expected.value, metric?.unit))}`;
  },
  validate: async ({ metrics = [], expected }) => {
    const actual = metricAverage(metrics, expected.key);

    return Number.isFinite(actual) ? metricRuleResult(actual! <= expected.value, actual) : missingMetricResult();
  },
};

export const metricMinRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMin",
  message: ({ actual, expected, metrics }) => {
    const metric = metricSample(metrics, expected.key);

    return `${bold(metric?.title ?? expected.key)} ${bold(formatMetricValue(actual, metric?.unit))} is below the required minimum ${bold(formatMetricValue(expected.value, metric?.unit))}`;
  },
  validate: async ({ metrics = [], expected }) => {
    const actual = metricAverage(metrics, expected.key);

    return Number.isFinite(actual) ? metricRuleResult(actual! >= expected.value, actual) : missingMetricResult();
  },
};

export const metricMaxDeltaRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMaxDelta",
  message: ({ actual, expected, metrics }) => {
    const metric = metricSample(metrics, expected.key);

    return `${bold(metric?.title ?? expected.key)} changed by ${bold(formatMetricValue(actual, metric?.unit))}, which exceeds ${bold(formatMetricValue(expected.value, metric?.unit))}`;
  },
  validate: async ({ metrics = [], history = [], expected, currentReportUuid }) => {
    const current = metricAverage(metrics, expected.key);

    if (!Number.isFinite(current)) {
      return missingMetricResult();
    }

    const previous = previousMetricValue(history, expected.key, currentReportUuid);

    if (!Number.isFinite(previous)) {
      return metricRuleResult(true, undefined);
    }

    const actual = current! - previous!;

    return metricRuleResult(Math.abs(actual) <= expected.value, actual);
  },
};

export const metricMaxDeltaPercentRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMaxDeltaPercent",
  message: ({ actual, expected, metrics }) =>
    `${bold(metricSample(metrics, expected.key)?.title ?? expected.key)} changed by ${bold(formatMetricValue(actual, "%"))}, which exceeds ${bold(formatMetricValue(expected.value, "%"))}`,
  validate: async ({ metrics = [], history = [], expected, currentReportUuid }) => {
    const current = metricAverage(metrics, expected.key);

    if (!Number.isFinite(current)) {
      return missingMetricResult();
    }

    const previous = previousMetricValue(history, expected.key, currentReportUuid);

    if (!Number.isFinite(previous)) {
      return metricRuleResult(true, undefined);
    }

    const actual = previous !== 0 ? ((current! - previous!) / Math.abs(previous!)) * 100 : undefined;

    return Number.isFinite(actual)
      ? metricRuleResult(Math.abs(actual!) <= expected.value, actual)
      : missingMetricResult();
  },
};

export const qualityGateDefaultRules = [
  maxFailuresRule,
  minTestsCountRule,
  successRateRule,
  maxDurationRule,
  allTestsContainEnvRule,
  environmentsTestedRule,
  metricMaxRule,
  metricMinRule,
  metricMaxDeltaRule,
  metricMaxDeltaPercentRule,
];
