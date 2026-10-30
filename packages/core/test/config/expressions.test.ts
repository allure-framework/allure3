import { describe, expect, it } from "vite-plus/test";

import { compileExpression, compilePredicate, isExpression } from "../../src/config/expressions.js";

describe("configuration expressions", () => {
  it("recognizes explicit expression prefixes only", () => {
    const recognized = ["${{ true }}", "  ${{ true }}  ", "${{", "$${{ true }}", "owner", "/owner/"].map(isExpression);

    expect(recognized).toEqual([true, true, true, false, false, false]);
  });

  it("reuses a parsed string predicate across evaluations", () => {
    const predicate = compilePredicate(" ${{ name.matches('^internal_') }} ", "hideLabels[0]", { name: "string" });

    const results = ["internal_id", "public", "internal_owner"].map((name) => predicate({ name }));

    expect(results).toEqual([true, false, true]);
  });

  it("supports guarded optional fields and numeric category conditions", () => {
    const predicate = compilePredicate(
      "${{ has(data.message) && data.duration > 42 && data.message.contains('timeout') }}",
      "categories[0].matchers",
      { data: "map" },
    );

    const results = [
      { duration: 100 },
      { duration: 100, message: "timeout" },
      { duration: 10, message: "timeout" },
    ].map((data) => predicate({ data }));

    expect(results).toEqual([false, true, false]);
  });

  it.each(["true", "${{ true", "${{ name. }}", "${{ process.env.SECRET == 'x' }}", "${{ 42 }}"])(
    "rejects an invalid predicate with its configuration path: %s",
    (input) => {
      const compile = () => compilePredicate(input, "hideLabels[2]", { name: "string" });

      expect(compile).toThrow("Invalid expression at hideLabels[2]:");
    },
  );

  it.each(["${{ data.value }}", "${{ data.message.matches('[') }}"])(
    "raises evaluation errors with their configuration path: %s",
    (input) => {
      const predicate = compilePredicate(input, "categories[1].matchers", { data: "map" });

      const evaluate = () => predicate({ data: { value: "truthy", message: "timeout" } });

      expect(evaluate).toThrow("Invalid expression at categories[1].matchers:");
    },
  );

  it("evaluates only declared context variables", () => {
    const predicate = compilePredicate("${{ data.message == 'timeout' }}", "categories[0].matchers", { data: "map" });

    const result = predicate({ data: { message: "timeout" }, ignored: new Date() });

    expect(result).toBe(true);
  });

  it("evaluates supplied data by reference", () => {
    const expression = compileExpression("${{ data }}", "expression", { data: "map" });
    const data = { message: "timeout", labels: [{ name: "owner", value: "alice" }] };

    const result = expression({ data });

    expect(result).toBe(data);
  });

  it.each([undefined, "string"] as const)("evaluates string expressions with result type %s", (resultType) => {
    const expression = compileExpression("${{ name }}", "expression", { name: "string" }, { resultType });

    const result = expression({ name: "Report" });

    expect(result).toBe("Report");
  });

  it("rejects a statically incompatible string result", () => {
    const compile = () => compileExpression("${{ true }}", "expression", {}, { resultType: "string" });

    expect(compile).toThrow("Invalid expression at expression: expression must return a string");
  });

  it("checks dynamically typed string results at evaluation", () => {
    const expression = compileExpression("${{ data.value }}", "expression", { data: "map" }, { resultType: "string" });

    const evaluate = () => expression({ data: { value: false } });

    expect(evaluate).toThrow("Invalid expression at expression: expression must return a string");
  });
});
