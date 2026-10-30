import type { QualityGateConfig, QualityGateRules } from "../qualityGate.js";

type RegisteredQualityGateRule = NonNullable<QualityGateConfig["use"]>[number];

/** Serialized rule definitions are normalized to runtime callbacks by the configuration loader. */
export type QualityGateRuleInput =
  | string
  | {
      rule: string;
      message?: string | RegisteredQualityGateRule["message"];
      successMessage?: string | RegisteredQualityGateRule["successMessage"];
      /** Trusted async JavaScript function body, or a native JavaScript validator. */
      validate?: string | RegisteredQualityGateRule["validate"];
    };

export type QualityGateRulesInput = Omit<QualityGateRules, "filter"> & {
  id?: QualityGateRules["id"];
  fastFail?: QualityGateRules["fastFail"];
  filter?: string | QualityGateRules["filter"];
};

export type QualityGateConfigInput = Omit<QualityGateConfig, "enabled" | "rules" | "use"> & {
  enabled?: boolean | string;
  rules?: QualityGateRulesInput[];
  use?: QualityGateRuleInput[];
};
