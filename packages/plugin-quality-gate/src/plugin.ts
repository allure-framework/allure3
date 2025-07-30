import type { TestError, TestResult } from "@allurereport/core-api";
import type {
  AllureStore,
  Plugin,
  PluginContext,
  QualityGateValidationResult,
  RealtimeSubscriber,
} from "@allurereport/plugin-api";
import * as console from "node:console";
import { gray, red } from "yoctocolors";
import {
  type QualityGateContext,
  type QualityGatePluginOptions,
  type QualityGateRule,
  QualityGateRuleMode,
} from "./model.js";
import { qualityGateDefaultRules } from "./rules.js";

export class QualityGatePlugin implements Plugin {
  #context: QualityGateContext;
  #use: QualityGateRule[];
  /**
   * Marks that the plugin has been printed output
   * Can be used to prevent reporting verification results twice in start subscription and then in done method
   */
  #reported: boolean = false;

  constructor(private readonly options: QualityGatePluginOptions) {
    this.#context = {
      rulesState: {},
      store: undefined,
    };
    this.#use = options?.use ?? qualityGateDefaultRules;
  }

  /**
   * Converts quality gate results to a terminal-friendly string
   */
  #stringifyValidationResults(results: QualityGateValidationResult[]) {
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
  #createQualityGateTestErrors(results: QualityGateValidationResult[]): TestError[] {
    return results.map((result) => ({
      message: `Quality Gate (${result.rule}): ${result.message}`,
      actual: result.actual,
      expected: result.expected,
    }));
  }

  async #validate(trs: TestResult[], ruleFilter: (rule: QualityGateRule) => boolean = () => true) {
    const { rules } = this.options;
    const results: QualityGateValidationResult[] = [];

    for (const ruleset of rules) {
      for (const [key, value] of Object.entries(ruleset)) {
        if (key === "filter" || key === "id") {
          continue;
        }

        const rule = this.#use.findLast((r) => r.rule === key);

        if (!rule) {
          throw new Error(
            `Rule ${key} is not provided. Make sure you have provided it in the "use" field of the quality gate config!`,
          );
        }

        if (!ruleFilter(rule)) {
          continue;
        }

        const ruleId = ruleset.id ? [ruleset.id, rule.rule].join("/") : rule.rule;
        const result = await rule.validate(trs, value, {
          ...this.#context,
          state: this.#context.rulesState[ruleId],
          filter: ruleset?.filter ?? (() => true),
        });

        this.#context.rulesState[ruleId] = result.actual;

        if (result.success) {
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
  }

  #validateRelative(trs: TestResult[]) {
    return this.#validate(trs, (rule) => rule.mode === QualityGateRuleMode.Relative);
  }

  #validateAbsolute(trs: TestResult[]) {
    return this.#validate(trs);
  }

  async start(context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void> {
    this.#context.store = store;

    if (!this.options.rules?.length || !this.options.fastFail) {
      return;
    }

    realtime.onTestResults(async (trIds) => {
      const trs = await Promise.all(trIds.map((id) => store.testResultById(id)));
      const results = await this.#validateRelative(trs.filter(Boolean) as TestResult[]);

      if (results.length === 0) {
        return;
      }

      const errors = this.#createQualityGateTestErrors(results);
      const formattedError = this.#stringifyValidationResults(results);

      errors.forEach((error) => {
        context.dispatcher.sendGlobalError(error);
      });

      if (this.#reported) {
        return;
      }

      context.dispatcher.sendTerminationRequest(
        1,
        "Quality Gate validation has been failed. Process has been terminated due to fast fail mode is enabled.",
      );

      console.error(formattedError);

      this.#reported = true;
    });
  }

  async done(context: PluginContext, store: AllureStore): Promise<void> {
    if (!this.options.rules?.length) {
      return;
    }

    const trs = await store.allTestResults();
    const results = await this.#validateAbsolute(trs.filter(Boolean));

    if (results.length === 0) {
      return;
    }

    const errors = this.#createQualityGateTestErrors(results);
    const formattedError = this.#stringifyValidationResults(results);

    errors.forEach((error) => {
      context.dispatcher.sendGlobalError(error);
    });

    if (this.#reported) {
      return;
    }

    context.dispatcher.sendTerminationRequest(1, "Quality Gate validation has been failed");

    console.error(formattedError);

    this.#reported = true;
  }
}
