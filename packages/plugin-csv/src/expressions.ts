import { type TestResult, compileExpression, isExpression } from "@allurereport/core-api";
import type { PluginExpressionContext } from "@allurereport/plugin-api";
import { UnsignedInt } from "@marcbachmann/cel-js/evaluator";

export const resolveCsvAccessor = (source: string, { path, env }: PluginExpressionContext) => {
  if (!isExpression(source)) {
    return source;
  }
  const evaluate = compileExpression(source, path, { test: "map", env: "map" });
  return (test: TestResult): string | undefined => {
    const result = evaluate({ test, env });
    if (result === null) {
      return undefined;
    }
    if (typeof result !== "string") {
      throw new TypeError(`Invalid expression at ${path}: CSV accessor must return a string or null`);
    }
    return result;
  };
};

export const resolveCsvComparator = (source: string, { path, env }: PluginExpressionContext) => {
  const evaluate = compileExpression(source, path, { a: "map", b: "map", env: "map" });
  return (a: TestResult, b: TestResult): number => {
    const result = evaluate({ a, b, env });
    const integer = typeof result === "bigint" || result instanceof UnsignedInt;
    const numeric = integer ? Number(result) : result;
    if (typeof numeric !== "number" || !Number.isFinite(numeric) || (integer && !Number.isSafeInteger(numeric))) {
      throw new TypeError(
        `Invalid expression at ${path}: CSV comparator must return a finite, safely representable number`,
      );
    }
    return numeric;
  };
};
