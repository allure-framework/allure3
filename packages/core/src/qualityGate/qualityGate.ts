import { DEFAULT_ENVIRONMENT, type KnownTestFailure, type TestError, type TestResult } from "@allurereport/core-api";
import type { QualityGateConfig, QualityGateRule, QualityGateValidationResult } from "@allurereport/plugin-api";
import { gray, red } from "yoctocolors";
import { qualityGateDefaultRules } from "./rules.js";

/**
 * Converts quality gate results to a terminal-friendly string
 */
export const stringifyQualityGateResults = (results: QualityGateValidationResult[]) => {
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

/**
 * Converts quality gate results into test errors which can be send to the report and rendered
 */
export const convertQualityGateResultsToTestErrors = (results: QualityGateValidationResult[]): TestError[] => {
  return results.map((result) => ({
    message: `Quality Gate (${result.rule}): ${result.message}`,
    actual: result.actual,
    expected: result.expected,
  }));
};

export class QualityGateState {
  #state: Record<string, any> = {};

  setResult(rule: string, value: any) {
    this.#state[rule] = value;
  }

  getResult(rule: string) {
    return this.#state[rule];
  }
}

export class QualityGate {
  constructor(private readonly config: QualityGateConfig) {}

  async validate(payload: {
    state?: QualityGateState;
    trs: TestResult[];
    knownIssues: KnownTestFailure[];
    environment?: string;
  }): Promise<{ fastFailed: boolean; results: QualityGateValidationResult[] }> {
    const { state, trs, knownIssues, environment } = payload;
    const { rules, use = [...qualityGateDefaultRules] as QualityGateRule<any>[] } = this.config;
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

        const trsToValidate = ruleset.filter ? trs.filter(ruleset.filter) : trs;
        const ruleId = ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule;
        const result = await rule.validate({
          trs: trsToValidate,
          state: {
            getResult: () => state?.getResult?.(ruleId),
            setResult: (value: any) => state?.setResult?.(ruleId, value),
          },
          expected,
          knownIssues,
          environment: environment || DEFAULT_ENVIRONMENT,
        });

        if (result.success) {
          continue;
        }

        results.push({
          ...result,
          expected,
          rule: ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule,
          message: rule.message({
            actual: result.actual,
            expected,
          }),
          environment: environment || DEFAULT_ENVIRONMENT,
        });

        if (ruleset.fastFail) {
          fastFailed = true;
          break;
        }
      }
    }

    return {
      fastFailed,
      results,
    };
  }
}
