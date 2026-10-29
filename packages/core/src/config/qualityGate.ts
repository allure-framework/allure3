import type {
  QualityGateConfig,
  QualityGateConfigInput,
  QualityGateRule,
  QualityGateRuleInput,
} from "@allurereport/plugin-api";

import { qualityGateDefaultRules } from "../qualityGate/rules.js";
import { CEL_DYNAMIC_TYPE, compileExpression, isExpression } from "./expressions.js";
import { compileQualityGateScript } from "./qualityGateScript.js";
import { evaluateGateValue, resolveExpected, validateExpected } from "./qualityGateValues.js";

const invalid = (path: string, message: string): never => {
  throw new Error(`Invalid configuration at ${path}: ${message}`);
};

const message = (
  value: string | QualityGateRule["message"] | undefined,
  path: string,
  fallback: QualityGateRule["message"] | undefined,
  generic: string,
): QualityGateRule["message"] | undefined => {
  if (value === undefined || typeof value === "function") {
    return value ?? fallback;
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
  let warned = false;
  return (payload) => {
    try {
      return String(evaluate(payload));
    } catch (error) {
      if (!warned) {
        console.warn(error instanceof Error ? error.message : String(error));
        warned = true;
      }
      return fallback?.(payload) ?? generic;
    }
  };
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
  const validate =
    typeof input.validate === "string"
      ? compileQualityGateScript(input.validate, `${path}.validate`)
      : (input.validate ?? builtin?.validate);
  const resolvedMessage = message(
    input.message,
    `${path}.message`,
    builtin?.message,
    `Quality gate rule ${name} failed`,
  );
  if (!validate || typeof validate !== "function" || !resolvedMessage) {
    return invalid(path, "a custom rule requires validate and message");
  }
  const successMessage = message(
    input.successMessage,
    `${path}.successMessage`,
    builtin?.successMessage,
    `Quality gate rule ${name} passed`,
  );
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
    return undefined;
  }
  if (input.use !== undefined && !Array.isArray(input.use)) {
    return invalid("qualityGate.use", "expected a list of rule definitions");
  }
  if (input.rules !== undefined && !Array.isArray(input.rules)) {
    return invalid("qualityGate.rules", "expected a list of rulesets");
  }
  const use = input.use?.map((rule, index) => resolveRule(rule, `qualityGate.use[${index}]`));
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
