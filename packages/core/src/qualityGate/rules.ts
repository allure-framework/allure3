import {
  filterIncludedInSuccessRate,
  filterSuccessful,
  filterUnsuccessful,
  getSuccessRate,
  type MetricSample,
  type TestResult,
} from "@allurereport/core-api";
import { type QualityGateMetricHistoryPoint, type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

type MetricRuleConfig = {
  key: string;
  value: number;
  title?: string;
  unit?: string;
};

const stringArrayStateValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

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

const formatQualityGateNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
};

const formatMetricValue = (value: number, unit?: string) => {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const formatted = formatQualityGateNumber(value);

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

type AttemptsState<T> = Record<string, { at: number; value: T; excluded?: true }>;

const attemptKey = (tr: TestResult) => `${tr.environment ?? ""}:${tr.retryHash ?? tr.id}`;

const attemptTime = (tr: TestResult) => tr.stop ?? tr.start ?? 0;

/**
 * Framework-level retries produce several results for the same test, so accumulated state is kept per test
 * (retry hash within an environment) and the latest attempt wins. Attempts which arrive out of order are ignored
 * when an older attempt is reported after a newer one.
 *
 * `excluded` are attempts which don't take part in the rule (filtered out or ignored failures). When such an attempt is
 * the latest one, the test stops counting, so an earlier attempt can't leave it in the result.
 */
const recordAttempts = <T>(
  previous: unknown,
  trs: TestResult[],
  toValue: (tr: TestResult) => T,
  excluded: TestResult[] = [],
): AttemptsState<T> => {
  const attempts: AttemptsState<T> = {};

  if (typeof previous === "object" && previous !== null && !Array.isArray(previous)) {
    for (const [key, attempt] of Object.entries(previous)) {
      if (typeof attempt === "object" && attempt !== null && "at" in attempt && "value" in attempt) {
        attempts[key] = attempt as AttemptsState<T>[string];
      }
    }
  }

  for (const tr of trs) {
    const key = attemptKey(tr);
    const at = attemptTime(tr);

    if (attempts[key] && attempts[key].at > at) {
      continue;
    }

    attempts[key] = { at, value: toValue(tr) };
  }

  // an attempt which is counted wins a tie against an excluded one
  for (const tr of excluded) {
    const key = attemptKey(tr);
    const at = attemptTime(tr);

    if (attempts[key] && attempts[key].at >= at) {
      continue;
    }

    attempts[key] = { at, value: undefined as T, excluded: true };
  }

  return attempts;
};

const attemptValues = <T>(attempts: AttemptsState<T>): T[] =>
  Object.values(attempts)
    .filter(({ excluded }) => !excluded)
    .map(({ value }) => value);

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} exceeds the allowed threshold value ${bold(String(expected))}`,
  successMessage: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} is within the allowed threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(state.getResult(), trs, (tr) => filterUnsuccessful(tr), excluded);
    const testResults = trs.filter(filterUnsuccessful).map((tr) => tr.id);
    const actual = attemptValues(attempts).filter(Boolean).length;

    state.setResult(attempts, testResults);

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
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(state.getResult(), trs, () => true, excluded);
    const actual = attemptValues(attempts).length;

    state.setResult(attempts, []);

    return {
      success: actual >= expected,
      actual,
      testResults: [],
    };
  },
};

export const newTestsRule: QualityGateRule<boolean, number> = {
  rule: "newTests",
  message: ({ actual, expected }) =>
    expected
      ? `No new tests were found; expected at least one new test`
      : `The number of new tests ${bold(String(actual))} does not match the expected policy`,
  successMessage: ({ actual }) => `New tests were found: ${bold(String(actual))}`,
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(state.getResult(), trs, (tr) => tr.transition === "new", excluded);
    const testResults = trs.filter((tr) => tr.transition === "new").map((tr) => tr.id);
    const actual = attemptValues(attempts).filter(Boolean).length;

    state.setResult(attempts, testResults);

    return {
      success: !expected || actual > 0,
      actual,
      testResults,
    };
  },
};

export const successRateRule: QualityGateRule<number> = {
  rule: "successRate",
  message: ({ actual, expected }) =>
    `Success rate ${bold(formatQualityGateNumber(actual))} is less, than expected ${bold(formatQualityGateNumber(expected))}`,
  successMessage: ({ actual, expected }) =>
    `Success rate ${bold(formatQualityGateNumber(actual))} is not less, than expected ${bold(formatQualityGateNumber(expected))}`,
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(
      state.getResult(),
      trs,
      (tr) => ({
        eligible: filterIncludedInSuccessRate(tr),
        passed: filterSuccessful(tr),
      }),
      excluded,
    );
    const eligible = attemptValues(attempts).filter(({ eligible }) => eligible);
    const totalCount = eligible.length;
    const passedCount = eligible.filter(({ passed }) => passed).length;
    const testResults = trs
      .filter(filterIncludedInSuccessRate)
      .filter(filterUnsuccessful)
      .map((tr) => tr.id);
    const rate = getSuccessRate({ passed: passedCount, failed: totalCount - passedCount });

    state.setResult(attempts, testResults);

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
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(state.getResult(), trs, (tr) => tr.duration ?? 0, excluded);
    const actual = Math.max(0, ...attemptValues(attempts));
    const tooLongTrs = trs.filter((tr) => (tr.duration ?? 0) > expected);
    const testResults = tooLongTrs.map((tr) => tr.id);

    state.setResult(attempts, testResults);

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
  validate: async ({ trs, expected, state, excluded }) => {
    const attempts = recordAttempts(state.getResult(), trs, (tr) => (tr.environment ?? "") !== expected, excluded);
    const testResults = trs.filter((tr) => (tr.environment ?? "") !== expected).map((tr) => tr.id);
    const actual = attemptValues(attempts).filter(Boolean).length;

    state.setResult(attempts, testResults);

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
  newTestsRule,
  successRateRule,
  maxDurationRule,
  allTestsContainEnvRule,
  environmentsTestedRule,
  metricMaxRule,
  metricMinRule,
  metricMaxDeltaRule,
  metricMaxDeltaPercentRule,
];
