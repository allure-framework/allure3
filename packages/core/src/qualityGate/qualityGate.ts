import { type MetricSample, type TestError, type TestResult } from "@allurereport/core-api";
import type {
  QualityGateConfig,
  QualityGateMetricHistoryPoint,
  QualityGateRule,
  QualityGateValidationResult,
} from "@allurereport/plugin-api";
import { bold, gray, red } from "yoctocolors";

import { isIgnoredFailure } from "../resolutions.js";
import { qualityGateDefaultRules } from "./rules.js";

/**
 * Validation results contain every evaluated rule, no matter whether it has been passed or not.
 * Use it whenever only the failed ones matter, e.g. to calculate an exit code or to print an error.
 */
export const filterFailedQualityGateResults = (results: QualityGateValidationResult[]) =>
  results.filter(({ success }) => !success);

const formatQualityGateValue = (value: any) => (Array.isArray(value) ? value.join(", ") : String(value));

/**
 * Fallback message for the rules which don't provide their own `successMessage`.
 */
const defaultSuccessMessage = ({ actual, expected }: { actual: any; expected: any }) =>
  `The rule has been passed; actual ${bold(formatQualityGateValue(actual))}, expected ${bold(formatQualityGateValue(expected))}`;

/**
 * Converts quality gate results to a terminal-friendly string.
 * Passed rules are omitted, only failures are reported.
 */
export const stringifyQualityGateResults = (results: QualityGateValidationResult[]) => {
  const failedResults = filterFailedQualityGateResults(results);

  if (failedResults.length === 0) {
    return "";
  }

  const lines = [red("Quality Gate failed with following issues:")];
  const maxMessageLength = Math.max(...failedResults.map((r) => r.message.length));

  lines.push("");

  failedResults.forEach((result) => {
    lines.push(` ${red("⨯")} ${result.message.padEnd(maxMessageLength, " ")}    ${gray(result.rule)}`);
  });

  lines.push("");
  lines.push(red(`${failedResults.length} quality gate rules have been failed.`));

  return lines.join("\n");
};

/**
 * Converts quality gate results into test errors which can be send to the report and rendered.
 * Passed rules don't produce any error.
 */
export const convertQualityGateResultsToTestErrors = (results: QualityGateValidationResult[]): TestError[] => {
  return filterFailedQualityGateResults(results).map((result) => ({
    message: `Quality Gate (${result.rule}): ${result.message}`,
    actual: result.actual,
    expected: result.expected,
  }));
};

export class QualityGateState {
  #state: Record<string, { result: unknown; testResults: string[] }> = {};
  #processedTestResultIds = new Set<string>();

  setResult(rule: string, value: unknown, testResults: string[] = []) {
    const previousTestResults = this.#state[rule]?.testResults ?? [];

    this.#state[rule] = {
      result: value,
      testResults: [...new Set([...previousTestResults, ...testResults])],
    };
  }

  getResult(rule: string) {
    return this.#state[rule]?.result;
  }

  getTestResults(rule: string) {
    return [...(this.#state[rule]?.testResults ?? [])];
  }

  markTestResultsProcessed(testResults: TestResult[]) {
    testResults.forEach(({ id }) => this.#processedTestResultIds.add(id));
  }

  isTestResultProcessed(trId: string) {
    return this.#processedTestResultIds.has(trId);
  }
}

export class QualityGate {
  constructor(private readonly config: QualityGateConfig) {}

  async validate(payload: {
    state?: QualityGateState;
    trs: TestResult[];
    metrics?: MetricSample[];
    previousHistory?: QualityGateMetricHistoryPoint[];
    environment?: string;
  }): Promise<{ fastFailed: boolean; results: QualityGateValidationResult[] }> {
    const { state, trs, metrics = [], previousHistory = [], environment } = payload;
    const trsToValidateById = new Map<string, TestResult>();

    for (const tr of trs) {
      if (tr.isRetry || isIgnoredFailure(tr) || state?.isTestResultProcessed(tr.id)) {
        continue;
      }

      trsToValidateById.set(tr.id, tr);
    }

    const trsToValidate = trsToValidateById.values().toArray();
    const { rules, use = [...qualityGateDefaultRules] as QualityGateRule[] } = this.config;
    const results: QualityGateValidationResult[] = [];
    let fastFailed = false;

    if (!rules?.length) {
      return {
        fastFailed: false,
        results,
      };
    }

    for (const ruleset of rules) {
      if (fastFailed) {
        break;
      }

      const filteredTrs = ruleset.filter ? trsToValidate.filter(ruleset.filter) : trsToValidate;

      for (const [key, expected] of Object.entries(ruleset)) {
        // reserved rules configuration keys
        if (key === "filter" || key === "id" || key === "fastFail") {
          continue;
        }

        const rule = use.filter((r) => r.rule === key).pop();

        if (!rule) {
          throw new Error(
            `Rule ${key} is not provided. Make sure you have provided it in the "use" field of the quality gate config!`,
          );
        }

        const ruleId = ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule;
        const result = await rule.validate({
          trs: filteredTrs,
          state: {
            getResult: () => state?.getResult?.(ruleId),
            setResult: (value: unknown, testResults: string[]) => state?.setResult?.(ruleId, value, testResults),
          },
          expected,
          metrics,
          previousHistory,
          environment,
        });

        const messagePayload = {
          actual: result.actual,
          expected,
        };

        results.push({
          ...result,
          expected,
          rule: ruleId,
          message: result.success
            ? (rule.successMessage ?? defaultSuccessMessage)(messagePayload)
            : rule.message(messagePayload),
          environment,
          testResults: [...new Set([...(state?.getTestResults(ruleId) ?? []), ...result.testResults])],
        });

        if (!result.success && ruleset.fastFail) {
          fastFailed = true;
          break;
        }
      }
    }

    state?.markTestResultsProcessed(trsToValidate);

    return {
      fastFailed,
      results,
    };
  }
}
