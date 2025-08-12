import { filterSuccessful, filterUnsuccessful } from "@allurereport/core-api";
import { type QualityGateRule } from "@allurereport/plugin-api";
import { bold } from "yoctocolors";

export const maxFailuresRule: QualityGateRule<number> = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `Maximum number of failed tests ${bold(String(actual))} is more, than expected ${bold(String(expected))}`,
  validate: async ({ trs, knownIssues, expected, state = 0 }) => {
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const unknown = trs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const failedTrs = unknown.filter(filterUnsuccessful);
    const actual = failedTrs.length + state;

    return {
      success: actual < expected,
      actual,
      expected,
    };
  },
};

export const minTestsCountRule: QualityGateRule<number> = {
  rule: "minTestsCount",
  message: ({ actual, expected }) =>
    `Minimum number of tests ${bold(String(actual))} is less, than expected ${bold(String(expected))}`,
  validate: async ({ trs, expected, state = 0 }) => {
    const actual = trs.length + state;

    return {
      success: actual >= expected,
      actual,
      expected,
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
      expected,
    };
  },
};

export const qualityGateDefaultRules = [maxFailuresRule, minTestsCountRule, successRateRule];
