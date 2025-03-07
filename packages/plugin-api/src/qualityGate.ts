import type { AllureStore } from "./store.js";

export type QualityGateRules = Record<string, any>;

export type QualityGateRulesBaseMeta<T> = {
  type: T;
};

export type QualityGateLabelsRulesMeta = QualityGateRulesBaseMeta<"label"> & {
  name: string;
  value: string;
};

export type QualityGateParametersRulesMeta = QualityGateRulesBaseMeta<"parameter"> & {
  name: string;
  value: string;
};

export type QualityGateLabelsEnforceConfig = {
  type: "label";
  name: string;
  value: string;
  rules: QualityGateRules;
};

export type QualityGateParametersEnforceConfig = {
  type: "parameter";
  name: string;
  value: string;
  rules: QualityGateRules;
};

export type QualityGateRulesMeta =
  | Omit<QualityGateLabelsRulesMeta, "rules">
  | Omit<QualityGateParametersRulesMeta, "rules">;

export type QualityGateEnforceConfig = QualityGateLabelsEnforceConfig | QualityGateParametersEnforceConfig;

export type QualityGateValidationResult = {
  success: boolean;
  rule: string;
  meta?: QualityGateRulesMeta;
  expected?: number;
  actual?: number;
  message?: string;
};

export interface QualityGateValidator {
  validate(store: AllureStore): Promise<QualityGateValidationResult>;
}

export type QualityGateValidatorConstructor = new (limit: number, meta?: QualityGateRulesMeta) => QualityGateValidator;

export type QualityGateConfig = {
  rules?: QualityGateRules;
  enforce?: QualityGateEnforceConfig[];
  validators?: Record<string, QualityGateValidatorConstructor>;
};
