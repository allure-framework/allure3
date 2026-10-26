import type { QualityGateConfig, QualityGateRule, QualityGateRules } from "../qualityGate.js";

/** Serialized rule definitions are normalized to runtime callbacks by the configuration loader. */
export type QualityGateRuleInput =
  | string
  | {
      rule: string;
      message?: string | QualityGateRule["message"];
      successMessage?: string | QualityGateRule["successMessage"];
      /** Trusted async JavaScript function body, or a native JavaScript validator. */
      validate?: string | QualityGateRule["validate"];
    };

export type QualityGateRulesInput = Omit<QualityGateRules, "filter"> & {
  filter?: string | QualityGateRules["filter"];
};

export type QualityGateConfigInput = Omit<QualityGateConfig, "rules" | "use"> & {
  enabled?: boolean | string;
  rules?: QualityGateRulesInput[];
  use?: QualityGateRuleInput[];
};
