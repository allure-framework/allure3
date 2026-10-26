import type { TestResult } from "@allurereport/core-api";
import { UnsignedInt } from "@marcbachmann/cel-js/evaluator";

import { compileExpression } from "./expressions.js";

export const compileCsvAccessor = (source: string, path: string, env: Record<string, string>) => {
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

export const compileCsvComparator = (source: string, path: string, env: Record<string, string>) => {
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
