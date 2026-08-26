import { filterSuccessful, filterUnsuccessful } from "@allurereport/core-api";
import { type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} exceeds the allowed threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? 0;
    const unknown = trs.filter((tr) => !tr.known);
    const failedTrs = unknown.filter(filterUnsuccessful);
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

export const successRateRule: QualityGateRule<
  number,
  { totalCount: number; unknownCount: number; passedCount: number }
> = {
  rule: "successRate",
  message: ({ actual, expected }) =>
    `Success rate ${bold(String(actual))} is less, than expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const previous = state.getResult() ?? { totalCount: 0, unknownCount: 0, passedCount: 0 };
    const unknown = trs.filter((tr) => !tr.known);
    const passedTrs = unknown.filter(filterSuccessful);
    const notPassedTrs = unknown.filter((tr) => !filterSuccessful(tr));
    const totalCount = previous.totalCount + trs.length;
    const unknownCount = previous.unknownCount + unknown.length;
    const passedCount = previous.passedCount + passedTrs.length;
    const testResults = notPassedTrs.map((tr) => tr.id);
    const rate = totalCount === 0 ? 0 : unknownCount === 0 ? 1 : passedCount / unknownCount;

    state.setResult({ totalCount, unknownCount, passedCount }, testResults);

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

export const qualityGateDefaultRules = [
  maxFailuresRule,
  minTestsCountRule,
  successRateRule,
  maxDurationRule,
  allTestsContainEnvRule,
  environmentsTestedRule,
];
