import { describe, expect, it } from "vite-plus/test";

import { CEL_DYNAMIC_TYPE, compileExpression } from "../../src/utils/expression.js";

describe("strict configuration expression values", () => {
  it("evaluates declared dynamic values without boolean coercion", () => {
    const expression = compileExpression(
      "${{ 'actual: ' + string(actual) }}",
      "qualityGate.use[0].message",
      {
        actual: CEL_DYNAMIC_TYPE,
      },
      { resultType: "string" },
    );

    const actual = expression({ actual: 3 });

    expect(actual).toBe("actual: 3");
  });

  it.each(["${{", "${{ missing }}", "${{ 42 }}"])("rejects invalid strict predicates: %s", (input) => {
    const compile = () => compileExpression(input, "qualityGate.rules[0].filter", {}, { resultType: "bool" });

    expect(compile).toThrow("qualityGate.rules[0].filter");
  });

  it("throws runtime failures with the configuration path", () => {
    const expression = compileExpression(
      "${{ test.status == 'failed' }}",
      "qualityGate.rules[0].filter",
      { test: "map" },
      { resultType: "bool" },
    );

    const evaluate = () => expression({ test: {} });

    expect(evaluate).toThrow("qualityGate.rules[0].filter");
  });

  it("rejects dynamic results with the wrong type", () => {
    const expression = compileExpression(
      "${{ actual }}",
      "qualityGate.use[0].message",
      { actual: CEL_DYNAMIC_TYPE },
      { resultType: "string" },
    );

    const evaluate = () => expression({ actual: 42 });

    expect(evaluate).toThrow("must return a string");
  });
});
