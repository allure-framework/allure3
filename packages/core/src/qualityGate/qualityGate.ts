import type { KnownTestFailure, TestError, TestResult } from "@allurereport/core-api";
import type { QualityGateConfig, QualityGateValidationResult } from "@allurereport/plugin-api";
import { gray, red } from "yoctocolors";
import { qualityGateDefaultRules } from "./rules.js";

export class QualityGate {
  #state: Record<string, any> = {};

  constructor(
    private readonly config: QualityGateConfig,
  ) {}

  // TODO: maybe we need to initialize multiple quality gates in this case?
  /**
   * Clears the quality gate state
   * Can be useful when it's required to perform validation on a different set of test results after the previous validation
   */
  resetState() {
    this.#state = {};
  }

  /**
   * Converts quality gate results to a terminal-friendly string
   */
  stringifyValidationResults(results: QualityGateValidationResult[]) {
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
  }

  /**
   * Converts quality gate results into test errors which can be send to the report and rendered
   */
  createQualityGateTestErrors(results: QualityGateValidationResult[]): TestError[] {
    return results.map((result) => ({
      message: `Quality Gate (${result.rule}): ${result.message}`,
      actual: result.actual,
      expected: result.expected,
    }));
  }

  async validate(payload: {
    trs: TestResult[];
    knownIssues: KnownTestFailure[];
  }): Promise<{ fastFailed: boolean; results: QualityGateValidationResult[] }> {
    const { trs, knownIssues } = payload;
    const { rules, use = [...qualityGateDefaultRules] } = this.config;
    const results: QualityGateValidationResult[] = [];
    let fastFailed = false;

    if (!rules?.length) {
      return {
        fastFailed: false,
        results,
      }
    }

    for (const ruleset of rules) {
      if (fastFailed) {
        break;
      }

      for (const [key, value] of Object.entries(ruleset)) {
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
          expected: value,
          trs,
          knownIssues,
          state: this.#state[ruleId],
        });

        this.#state[ruleId] = result.actual;

        if (result.success) {
          continue;
        }

        results.push({
          ...result,
          rule: ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule,
          message: rule.message(result),
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
