import { filterSuccessful, filterUnsuccessful } from "@allurereport/core-api";
import { type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `The number of failed tests ${bold(String(actual))} exceeds the allowed threshold value ${bold(String(expected))}`,
  validate: async ({ trs, knownIssues, expected, state }) => {
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const unknown = trs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const failedTrs = unknown.filter(filterUnsuccessful);
    const actual = failedTrs.length + (state.getResult() ?? 0);

    state.setResult(actual);

    return {
      success: actual <= expected,
      actual,
    };
  },
};

export const minTestsCountRule: QualityGateRule<number> = {
  rule: "minTestsCount",
  message: ({ actual, expected }) =>
    `The total number of tests ${bold(String(actual))} is less than the expected threshold value ${bold(String(expected))}`,
  validate: async ({ trs, expected, state }) => {
    const actual = trs.length + (state.getResult() ?? 0);

    state.setResult(actual);

    return {
      success: actual >= expected,
      actual,
    };
  },
};

export const successRateRule: QualityGateRule<number> = {
  rule: "successRate",
  message: ({ actual, expected }) =>
    `Success rate ${bold(String(actual))} is less, than expected ${bold(String(expected))}`,
  validate: async ({ trs, knownIssues, expected }) => {
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const unknown = trs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const passedTrs = unknown.filter(filterSuccessful);
    const rate = passedTrs.length === 0 ? 0 : passedTrs.length / unknown.length;

    return {
      success: rate >= expected,
      actual: rate,
    };
  },
};

export const maxDurationRule: QualityGateRule<number> = {
  rule: "maxDuration",
  message: ({ actual, expected }) =>
    `Maximum duration of some tests exceed the defined limit; actual ${bold(String(actual))}, expected ${bold(String(expected))}`,
  validate: async ({ trs, expected }) => {
    const actual = Math.max(...trs.map((tr) => tr.duration ?? 0));

    return {
      success: actual <= expected,
      actual,
    };
  },
};

/**
 * Fails if any test in the run does not have the given environment.
 * Expected: environment name (string).
 */
export const allTestsContainEnvRule: QualityGateRule<string> = {
  rule: "allTestsContainEnv",
  message: ({ actual, expected }) =>
    `Not all tests contain the required environment, ${bold(`"${expected}"`)}; ${bold(actual.length === 1 ? "one" : String(actual))} ${actual.length === 1 ? "test has" : "tests have"} different or missing environment`,
  validate: async ({ trs, expected }) => {
    const testsWithoutEnv = trs.filter((tr) => (tr.environment ?? "") !== expected);
    const actual = testsWithoutEnv.length;

    return {
      success: actual === 0,
      actual,
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

    state.setResult([...testedEnvs]);

    const missing = expected.filter((env) => !testedEnvs.has(env));

    return {
      success: missing.length === 0,
      actual: missing,
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
