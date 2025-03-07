import { filterSuccessful, filterUnsuccessful } from "@allurereport/core-api";
import {
  type AllureStore,
  type QualityGateConfig,
  type QualityGateRules,
  type QualityGateRulesMeta,
  type QualityGateValidationResult,
  type QualityGateValidator,
  type QualityGateValidatorConstructor,
} from "@allurereport/plugin-api";

// TODO replace abstraction with a helper method
export abstract class AbstractQualityGateValidator implements QualityGateValidator {
  constructor(
    readonly limit: number,
    readonly meta?: QualityGateRulesMeta,
  ) {}

  /**
   * Returns test results from the given store filtered by the validator meta data object
   * @param store
   */
  async getTestResultsFilteredByMeta(store: AllureStore) {
    const allTrs = await store.allTestResults();

    if (!this.meta) {
      return allTrs;
    }

    return allTrs.filter((tr) => {
      switch (this.meta?.type) {
        case "label":
          return tr.labels.some((label) => label.name === this.meta!.name && label.value === this.meta!.value);
        case "parameter":
          return tr.parameters.some(
            (parameter) => parameter.name === this.meta!.name && parameter.value === this.meta!.value,
          );
        default:
          return tr;
      }
    });
  }

  abstract validate(store: AllureStore): Promise<QualityGateValidationResult>;
}

export class MaxFailuresValidator extends AbstractQualityGateValidator {
  async validate(store: AllureStore) {
    const trs = (await this.getTestResultsFilteredByMeta(store)).filter((tr) => !tr.hidden).filter(filterUnsuccessful);

    return {
      success: trs.length <= this.limit,
      rule: "maxFailures",
      meta: this.meta,
      expected: this.limit,
      actual: trs.length,
    } as QualityGateValidationResult;
  }
}

export class MinTestsCountValidator extends AbstractQualityGateValidator {
  async validate(store: AllureStore) {
    const trs = (await this.getTestResultsFilteredByMeta(store)).filter((tr) => !tr.hidden);

    return {
      success: trs.length >= this.limit,
      rule: "minTestsCount",
      meta: this.meta,
      expected: this.limit,
      actual: trs.length,
    } as QualityGateValidationResult;
  }
}

export class SuccessRateValidator extends AbstractQualityGateValidator {
  async validate(store: AllureStore) {
    const knownIssues = await store.allKnownIssues();
    const trs = (await this.getTestResultsFilteredByMeta(store)).filter((tr) => !tr.hidden);
    const knownIssuesHistoryIds = knownIssues.map((ki) => ki.historyId);
    const unknown = trs.filter((tr) => !tr.historyId || !knownIssuesHistoryIds.includes(tr.historyId));
    const passed = unknown.filter(filterSuccessful);
    const rate = passed.length === 0 ? 0 : passed.length / unknown.length;

    return {
      success: rate >= this.limit,
      rule: "successRate",
      meta: this.meta,
      expected: this.limit,
      actual: rate,
    } as QualityGateValidationResult;
  }
}

export class QualityGate {
  result: QualityGateValidationResult[] = [];

  constructor(readonly config?: QualityGateConfig) {}

  get exitCode() {
    return this.result.some((res) => !res.success) ? 1 : 0;
  }

  get #mappedValidators() {
    return {
      maxFailures: MaxFailuresValidator,
      minTestsCount: MinTestsCountValidator,
      successRate: SuccessRateValidator,
      ...this.config?.validators,
    } as Record<string, QualityGateValidatorConstructor>;
  }

  #createRulesValidator = (rules: QualityGateRules, meta?: QualityGateRulesMeta) => {
    const validators: QualityGateValidator[] = [];

    Object.keys(rules).forEach((rule) => {
      const Validator = this.#mappedValidators[rule];

      if (!Validator) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const validator = new Validator(rules[rule], meta);

      validators.push(validator);
    });

    return validators;
  };

  validate = async (store: AllureStore) => {
    const { rules, enforce = [] } = this.config ?? {};
    const validators: QualityGateValidator[] = [];
    const result = [];

    if (rules) {
      validators.push(...this.#createRulesValidator(rules));
    }

    enforce.forEach((enforceConfig) => {
      const { rules: enforceRules, ...meta } = enforceConfig;

      validators.push(...this.#createRulesValidator(enforceRules, meta as unknown as QualityGateRulesMeta));
    });

    for (const validator of validators) {
      result.push(await validator.validate(store));
    }

    this.result = result;
  };
}
