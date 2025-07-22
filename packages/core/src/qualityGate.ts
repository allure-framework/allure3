import { filterSuccessful, filterUnsuccessful } from "@allurereport/core-api";
import {
  type AllureStore,
  type QualityGateConfig,
  type QualityGateRule,
  type QualityGateValidationResult,
} from "@allurereport/plugin-api";
import { bold, gray, red } from "yoctocolors";

export const maxFailuresRule: QualityGateRule = {
  rule: "maxFailures",
  message: ({ actual, expected }) =>
    `Maximum number of failed tests ${bold(actual)} is more, than expected ${bold(expected)}`,
  validate: async (expected: number, store, options) => {
    const knownIssues = await store.allKnownIssues();
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const trs = await store.allTestResults({ includeHidden: false });
    const filteredTrs = !options?.trFilter ? trs : trs.filter(options.trFilter);
    const unknown = filteredTrs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const failedTrs = unknown.filter(filterUnsuccessful);

    return {
      success: failedTrs.length <= expected,
      actual: failedTrs.length,
      expected,
    };
  },
};

export const minTestsCountRule: QualityGateRule = {
  rule: "minTestsCount",
  message: ({ actual, expected }) => `Minimum number of tests ${bold(actual)} is less, than expected ${bold(expected)}`,
  validate: async (expected: number, store, options) => {
    const trs = await store.allTestResults({ includeHidden: false });
    const filteredTrs = !options?.trFilter ? trs : trs.filter(options.trFilter);

    return {
      success: filteredTrs.length >= expected,
      actual: filteredTrs.length,
      expected,
    };
  },
};

export const successRateRule: QualityGateRule = {
  rule: "successRate",
  message: ({ actual, expected }) => `Success rate ${bold(actual)} is less, than expected ${bold(expected)}`,
  validate: async (expected: number, store, options) => {
    const knownIssues = await store.allKnownIssues();
    const knownIssuesHistoryIds = knownIssues.map(({ historyId }) => historyId);
    const trs = await store.allTestResults({ includeHidden: false });
    const filteredTrs = !options?.trFilter ? trs : trs.filter(options.trFilter);
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

/**
 * Executes quality gate with a given config and store
 * Returns array of validation results
 * @param store
 * @param config
 * @param options
 */
export const runQualityGate = async (
  store: AllureStore,
  config?: QualityGateConfig,
  options?: {
    includeAll?: boolean;
  },
) => {
  const { rules, use = qualityGateDefaultRules } = config ?? {};

  if (!rules) {
    return [];
  }

  const results: QualityGateValidationResult[] = [];

  for (const ruleset of rules) {
    for (const [key, value] of Object.entries(ruleset)) {
      if (key === "filter" || key === "id") {
        continue;
      }

      const rule = use.findLast((r) => r.rule === key);

      if (!rule) {
        throw new Error(
          `Rule ${key} is not provided. Make sure you have provided it in the "use" field of the quality gate config!`,
        );
      }

      const result = await rule.validate(value, store, {
        trFilter: ruleset?.filter ?? (() => true),
      });

      if (!options?.includeAll && result.success) {
        continue;
      }

      results.push({
        ...result,
        rule: ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule,
        message: rule.message(result),
      });
    }
  }

  return results;
};

/**
 * Formats quality gate results to a string that can be printed to the console
 * @param results
 */
export const stringifyQualityGateResults = (results: QualityGateValidationResult[]): string => {
  if (results.length === 0) {
    return "";
  }

  const lines = [red("Quality Gate failed with following issues:")];
  const maxMessageLength = Math.max(...results.map((r) => r.message.length));

  lines.push("");

  results.forEach((result) => {
    lines.push(` ${red("⨯")} ${result.message.padEnd(maxMessageLength, " ")}    ${gray(result.rule)}`);
  });

  lines.push("");
  lines.push(red(`${results.length} quality gate rules have been failed.`));

  return lines.join("\n");
};
