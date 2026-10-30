import { CEL_DYNAMIC_TYPE, compileExpression, isExpression } from "@allurereport/core-api";
import type {
  QualityGateConfig,
  QualityGateConfigInput,
  QualityGateRule,
  QualityGateRuleInput,
} from "@allurereport/plugin-api";

import { qualityGateDefaultRules } from "../qualityGate/rules.js";
import { evaluateGateValue, resolveExpected, validateExpected } from "./qualityGateValues.js";

const invalid = (path: string, message: string): never => {
  throw new Error(`Invalid configuration at ${path}: ${message}`);
};

const message = (
  value: string | QualityGateRule["message"] | undefined,
  path: string,
  inherited: QualityGateRule["message"] | undefined,
): QualityGateRule["message"] | undefined => {
  if (value === undefined || typeof value === "function") {
    return value ?? inherited;
  }
  if (typeof value !== "string") {
    return invalid(path, "expected a string or message callback");
  }
  if (!isExpression(value)) {
    return () => value;
  }
  const evaluate = compileExpression(
    value,
    path,
    { expected: CEL_DYNAMIC_TYPE, actual: CEL_DYNAMIC_TYPE },
    { resultType: "string" },
  );
  return (payload) => String(evaluate(payload));
};

const resolveRule = (input: QualityGateRuleInput, path: string): QualityGateRule => {
  if (typeof input !== "string" && (typeof input !== "object" || input === null || Array.isArray(input))) {
    return invalid(path, "expected a built-in name or rule definition");
  }
  const name = typeof input === "string" ? input : input.rule;
  if (typeof name !== "string" || name.trim().length === 0) {
    return invalid(`${path}.rule`, "expected a nonempty rule name");
  }
  const builtin = (qualityGateDefaultRules as QualityGateRule[]).find((rule) => rule.rule === name);
  if (typeof input === "string") {
    return builtin ?? invalid(path, `unknown built-in rule ${name}`);
  }
  if (input.validate !== undefined && typeof input.validate !== "function") {
    return invalid(
      `${path}.validate`,
      "expected a validator function; use a JavaScript configuration file for custom validation",
    );
  }
  const inherited = input.validate === undefined ? builtin : undefined;
  const validate = input.validate ?? inherited?.validate;
  const resolvedMessage = message(input.message, `${path}.message`, inherited?.message);
  if (!validate || !resolvedMessage) {
    return invalid(path, "a custom rule requires validate and message");
  }
  const successMessage = message(input.successMessage, `${path}.successMessage`, inherited?.successMessage);
  if (input.validate === validate && input.message === resolvedMessage && input.successMessage === successMessage) {
    return input as QualityGateRule;
  }
  return { rule: name, validate, message: resolvedMessage, successMessage };
};

export const resolveQualityGate = (input: QualityGateConfigInput | undefined): QualityGateConfig | undefined => {
  if (!input) {
    return undefined;
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const enabled =
    typeof input.enabled === "string"
      ? evaluateGateValue(input.enabled, "qualityGate.enabled", env)
      : input.enabled === undefined
        ? true
        : input.enabled;
  if (typeof enabled !== "boolean") {
    return invalid("qualityGate.enabled", "expected a boolean");
  }
  if (!enabled) {
    return { enabled: false };
  }
  if (input.use !== undefined && !Array.isArray(input.use)) {
    return invalid("qualityGate.use", "expected a list of rule definitions");
  }
  if (input.rules !== undefined && !Array.isArray(input.rules)) {
    return invalid("qualityGate.rules", "expected a list of rulesets");
  }
  const use = input.use?.map((rule, index) => resolveRule(rule, `qualityGate.use[${index}]`));
  const ruleNames = new Set((use ?? qualityGateDefaultRules).map((rule) => rule.rule));
  return {
    rules: input.rules?.map((ruleset, index) => {
      const path = `qualityGate.rules[${index}]`;
      if (typeof ruleset !== "object" || ruleset === null || Array.isArray(ruleset)) {
        return invalid(path, "expected a ruleset object");
      }
      if (ruleset.id !== undefined && typeof ruleset.id !== "string") {
        return invalid(`${path}.id`, "expected a string");
      }
      if (ruleset.fastFail !== undefined && typeof ruleset.fastFail !== "boolean") {
        return invalid(`${path}.fastFail`, "expected a boolean");
      }
      if (ruleset.filter !== undefined && typeof ruleset.filter !== "string" && typeof ruleset.filter !== "function") {
        return invalid(`${path}.filter`, "expected a CEL expression or filter callback");
      }
      const values = Object.fromEntries(
        Object.entries(ruleset).map(([name, value]) => {
          if (["id", "filter", "fastFail"].includes(name)) {
            return [name, value];
          }
          if (!ruleNames.has(name)) {
            return invalid(
              `${path}.${name}`,
              `no implementation registered for rule "${name}"; include it in qualityGate.use, which replaces the built-in defaults`,
            );
          }
          try {
            const expected = resolveExpected(value, `${path}.${name}`, env);
            if (expected.computed) {
              validateExpected(name, expected.value, `${path}.${name}`, use);
            }
            return [name, expected.value];
          } catch (cause) {
            throw new Error(
              `Invalid configuration at ${path}.${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
              { cause },
            );
          }
        }),
      );
      const { filter } = ruleset;
      if (typeof filter === "string") {
        const evaluate = compileExpression(
          filter,
          `${path}.filter`,
          { test: "map", env: "map" },
          { resultType: "bool" },
        );
        return { ...values, filter: (test) => evaluate({ test, env }) === true };
      }
      return { ...values, filter };
    }),
    use,
  };
};
