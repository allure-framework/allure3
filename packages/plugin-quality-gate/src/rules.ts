import { filterSuccessful, filterUnsuccessful, TestResult } from "@allurereport/core-api";
import { bold } from "yoctocolors";
import { type QualityGateRule, QualityGateRuleMode } from "./model.js";

export const maxFailuresRule: QualityGateRule = {
  rule: "maxFailures",
  mode: QualityGateRuleMode.Relative,
  message: ({ actual, expected }) =>
    `Maximum number of failed tests ${bold(actual)} is more, than expected ${bold(expected)}`,
  validate: async (trs: TestResult[], expected: number, context) => {
    const { store, filter, state = 0 } = context;
    const knownIssues = await store!.allKnownIssues();
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const filteredTrs = !filter ? trs : trs.filter(filter);
    const unknown = filteredTrs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const failedTrs = unknown.filter(filterUnsuccessful);

    return {
      success: state + failedTrs.length <= expected,
      actual: failedTrs.length,
      expected,
    };
  },
};

export const minTestsCountRule: QualityGateRule = {
  rule: "minTestsCount",
  mode: QualityGateRuleMode.Absolute,
  message: ({ actual, expected }) => `Minimum number of tests ${bold(actual)} is less, than expected ${bold(expected)}`,
  validate: async (trs: TestResult[], expected: number, context) => {
    const { filter } = context;
    const filteredTrs = !filter ? trs : trs.filter(filter);

    return {
      success: filteredTrs.length >= expected,
      actual: filteredTrs.length,
      expected,
    };
  },
};

export const successRateRule: QualityGateRule = {
  rule: "successRate",
  mode: QualityGateRuleMode.Absolute,
  message: ({ actual, expected }) => `Success rate ${bold(actual)} is less, than expected ${bold(expected)}`,
  validate: async (trs: TestResult[], expected: number, context) => {
    const { store, filter } = context;
    const knownIssues = await store!.allKnownIssues();
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const filteredTrs = !filter ? trs : trs.filter(filter);
    const unknown = filteredTrs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
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
