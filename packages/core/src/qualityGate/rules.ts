import { filterSuccessful, filterUnsuccessful, type MetricSample } from "@allurereport/core-api";
import { type QualityGateMetricHistoryPoint, type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

type SuccessRateState = {
  totalCount: number;
  passedCount: number;
};

type MetricRuleConfig = {
  key: string;
  value: number;
  title?: string;
  unit?: string;
};

const numberStateValue = (value: unknown): number => (Number.isFinite(value) ? Number(value) : 0);

const stringArrayStateValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const successRateStateValue = (value: unknown): SuccessRateState => {
  if (typeof value !== "object" || value === null) {
    return { totalCount: 0, passedCount: 0 };
  }

  const state = value as Partial<SuccessRateState>;

  return {
    totalCount: numberStateValue(state.totalCount),
    passedCount: numberStateValue(state.passedCount),
  };
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

const previousMetricValue = (history: QualityGateMetricHistoryPoint[], key: string): number | undefined => {
  const previousHistory = [...history].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  for (const historyPoint of previousHistory) {
    const value = historyPoint.metrics?.[key];

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const metricActual = (metrics: MetricSample[], key: string, value: number): MetricRuleConfig => {
  const sample = metrics.find((metric) => metric.key === key);

  return {
    key,
    value,
    ...(sample?.title ? { title: sample.title } : {}),
    ...(sample?.unit ? { unit: sample.unit } : {}),
  };
};

const formatMetricValue = (value: number, unit?: string) => {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const finiteValue = value as number;
  const formatted = Number.isInteger(finiteValue) ? String(finiteValue) : String(Number(finiteValue.toFixed(3)));

  return unit ? `${formatted} ${unit}` : formatted;
};

const metricRuleTitle = (actual: MetricRuleConfig) => actual.title ?? actual.key;

const metricRuleUnit = (actual: MetricRuleConfig, expected: MetricRuleConfig) => actual.unit ?? expected.unit;

const missingMetricResult = (actual: MetricRuleConfig) => ({
  success: false,
  actual,
  testResults: [],
});

const metricRuleResult = (success: boolean, actual: MetricRuleConfig) => ({
  success,
  actual,
  testResults: [],
});

const metricDeltaWithinThreshold = (delta: number, threshold: number, better?: MetricSample["better"]): boolean => {
  if (better === "lower") {
    return delta <= threshold;
  }

  if (better === "higher") {
    return -delta <= threshold;
  }

  return Math.abs(delta) <= threshold;
};

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} exceeds the allowed threshold value ${bold(String(expected))}`,
  successMessage: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} is within the allowed threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = numberStateValue(state.getResult());
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
  successMessage: ({ actual, expected }) =>
    `The total number of tests ${bold(String(actual))} meets the expected threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const actual = trs.length + numberStateValue(state.getResult());

    state.setResult(actual, []);

    return {
      success: actual >= expected,
      actual,
      testResults: [],
    };
  },
};

export const successRateRule: QualityGateRule<number> = {
  rule: "successRate",
  message: ({ actual, expected }) =>
    `Success rate ${bold(String(actual))} is less, than expected ${bold(String(expected))}`,
  successMessage: ({ actual, expected }) =>
    `Success rate ${bold(String(actual))} is not less, than expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = successRateStateValue(state.getResult());
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
  successMessage: ({ actual, expected }) =>
    `Maximum duration of the tests is within the defined limit; actual ${bold(String(actual))}, expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = numberStateValue(state.getResult());
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
    `Not all tests contain the required "${bold(expected)}" environment, ${bold(String(actual))} tests have different or missing environment`,
  successMessage: ({ expected }) => `All tests contain the required "${bold(expected)}" environment`,
  validate: async ({ trs, expected, state }) => {
    const previous = numberStateValue(state.getResult());
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
  successMessage: ({ expected }) => `All expected environments were tested: "${expected.join('", "')}"`,
  validate: async ({ trs, expected, state }) => {
    const previouslyTested = new Set(stringArrayStateValue(state.getResult()));
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
  message: ({ actual, expected }) =>
    `${bold(metricRuleTitle(actual))} ${bold(formatMetricValue(actual.value, metricRuleUnit(actual, expected)))} exceeds the allowed maximum ${bold(formatMetricValue(expected.value, metricRuleUnit(actual, expected)))}`,
  validate: async ({ metrics = [], expected }) => {
    const value = metricAverage(metrics, expected.key);
    const actual = metricActual(metrics, expected.key, value ?? Number.NaN);

    return value === undefined ? missingMetricResult(actual) : metricRuleResult(value <= expected.value, actual);
  },
};

export const metricMinRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMin",
  message: ({ actual, expected }) =>
    `${bold(metricRuleTitle(actual))} ${bold(formatMetricValue(actual.value, metricRuleUnit(actual, expected)))} is below the required minimum ${bold(formatMetricValue(expected.value, metricRuleUnit(actual, expected)))}`,
  validate: async ({ metrics = [], expected }) => {
    const value = metricAverage(metrics, expected.key);
    const actual = metricActual(metrics, expected.key, value ?? Number.NaN);

    return value === undefined ? missingMetricResult(actual) : metricRuleResult(value >= expected.value, actual);
  },
};

export const metricMaxDeltaRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMaxDelta",
  message: ({ actual, expected }) =>
    `${bold(metricRuleTitle(actual))} changed by ${bold(formatMetricValue(actual.value, metricRuleUnit(actual, expected)))}, which exceeds ${bold(formatMetricValue(expected.value, metricRuleUnit(actual, expected)))}`,
  validate: async ({ metrics = [], previousHistory = [], expected }) => {
    const current = metricAverage(metrics, expected.key);

    if (current === undefined) {
      return missingMetricResult(metricActual(metrics, expected.key, Number.NaN));
    }

    const previous = previousMetricValue(previousHistory, expected.key);

    if (previous === undefined) {
      return metricRuleResult(true, metricActual(metrics, expected.key, 0));
    }

    const value = current - previous;
    const actual = metricActual(metrics, expected.key, value);
    const better = metrics.find((metric) => metric.key === expected.key)?.better;

    return metricRuleResult(metricDeltaWithinThreshold(value, expected.value, better), actual);
  },
};

export const metricMaxDeltaPercentRule: QualityGateRule<MetricRuleConfig> = {
  rule: "metricMaxDeltaPercent",
  message: ({ actual, expected }) =>
    `${bold(metricRuleTitle(actual))} changed by ${bold(formatMetricValue(actual.value, "%"))}, which exceeds ${bold(formatMetricValue(expected.value, "%"))}`,
  validate: async ({ metrics = [], previousHistory = [], expected }) => {
    const current = metricAverage(metrics, expected.key);

    if (current === undefined) {
      return missingMetricResult(metricActual(metrics, expected.key, Number.NaN));
    }

    const previous = previousMetricValue(previousHistory, expected.key);

    if (previous === undefined) {
      return metricRuleResult(true, metricActual(metrics, expected.key, 0));
    }

    const value = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : Number.NaN;
    const actual = metricActual(metrics, expected.key, value);
    const better = metrics.find((metric) => metric.key === expected.key)?.better;

    return Number.isFinite(value)
      ? metricRuleResult(metricDeltaWithinThreshold(value, expected.value, better), actual)
      : missingMetricResult(actual);
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
