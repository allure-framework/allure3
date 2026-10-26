import type { QualityGateRule } from "@allurereport/plugin-api";

import { qualityGateDefaultRules } from "../qualityGate/rules.js";
import { compileExpression, isExpression } from "./expressions.js";
import { qualityGateValue } from "./qualityGateValue.js";

export const evaluateGateValue = (source: string, path: string, env: Record<string, string>): unknown => {
  try {
    const evaluate = compileExpression(source, path, { env: "map" });
    return qualityGateValue(evaluate({ env }), true);
  } catch (cause) {
    throw new Error(`Invalid configuration at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
  }
};

export const resolveExpected = (
  input: unknown,
  path: string,
  env: Record<string, string>,
  ancestors = new Set<object>(),
): { value: unknown; computed: boolean } => {
  if (typeof input === "string" && isExpression(input)) {
    return { value: evaluateGateValue(input, path, env), computed: true };
  }
  if (
    typeof input !== "object" ||
    input === null ||
    ancestors.has(input) ||
    (!Array.isArray(input) && ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
  ) {
    return { value: input, computed: false };
  }
  ancestors.add(input);
  try {
    const entries = Object.entries(input).map(
      ([key, value]) => [key, resolveExpected(value, `${path}[${JSON.stringify(key)}]`, env, ancestors)] as const,
    );
    if (!entries.some(([, result]) => result.computed)) {
      return { value: input, computed: false };
    }
    const value = Array.isArray(input)
      ? entries.map(([, result]) => result.value)
      : Object.fromEntries(entries.map(([key, result]) => [key, result.value]));
    return { value: qualityGateValue(value), computed: true };
  } finally {
    ancestors.delete(input);
  }
};

/** Validate computed built-in domains without changing legacy literal/custom callback contracts. */
export const validateExpected = (name: string, value: unknown, path: string, use?: QualityGateRule[]) => {
  const builtin = (qualityGateDefaultRules as QualityGateRule[]).find((rule) => rule.rule === name);
  const selected = (use ?? qualityGateDefaultRules).filter((rule) => rule.rule === name).pop();
  if (!builtin || selected?.validate !== builtin.validate) {
    return;
  }
  let valid: boolean;
  switch (name) {
    case "newTests":
      valid = typeof value === "boolean";
      break;
    case "allTestsContainEnv":
      valid = typeof value === "string";
      break;
    case "environmentsTested":
      valid = Array.isArray(value) && value.every((item) => typeof item === "string");
      break;
    case "metricMax":
    case "metricMin":
    case "metricMaxDelta":
    case "metricMaxDeltaPercent":
      valid =
        typeof value === "object" &&
        value !== null &&
        "key" in value &&
        typeof value.key === "string" &&
        value.key.length > 0 &&
        "value" in value &&
        typeof value.value === "number" &&
        Number.isFinite(value.value) &&
        (!("title" in value) || typeof value.title === "string") &&
        (!("unit" in value) || typeof value.unit === "string");
      break;
    default:
      valid =
        typeof value === "number" && Number.isFinite(value) && value >= 0 && (name !== "successRate" || value <= 100);
  }
  if (!valid) {
    throw new TypeError(
      `Invalid configuration at ${path}: computed value does not match the ${name} rule's expected type or range`,
    );
  }
};
