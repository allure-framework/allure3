import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { compilePredicate, isExpression } from "../../src/config/expressions.js";

afterEach(() => vi.restoreAllMocks());

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

  it.each([
    "${{",
    "${{ }}",
    "${{ name. }}",
    "${{ process.env.SECRET == 'x' }}",
    "${{ name.matches('a', 'i') }}",
    "${{ 42 }}",
  ])("warns once and disables an invalid predicate: %s", (input) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const predicate = compilePredicate(input, "hideLabels[2]", { name: "string" });
    const results = [predicate({ name: "owner" }), predicate({ name: "tag" })];

    expect(results).toEqual([false, false]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("hideLabels[2]"));
  });

  it.each(["${{ data.value }}", "${{ data.message.matches('[') }}", "${{ data.missing == true }}"])(
    "deduplicates runtime failures without broadening matching: %s",
    (input) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const predicate = compilePredicate(input, "categories[1].matchers", { data: "map" });

      const results = [1, 2].map(() => predicate({ data: { value: "truthy", message: "timeout" } }));

      expect(results).toEqual([false, false]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("categories[1].matchers"));
    },
  );

  it("continues evaluating after a runtime failure and exposes only declared context", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const predicate = compilePredicate("${{ data.message == 'timeout' }}", "categories[0].matchers", { data: "map" });

    const results = [predicate({ data: {}, process }), predicate({ data: { message: "timeout" }, process })];

    expect(results).toEqual([false, true]);
  });

  it("copies plain context data while omitting undefined fields", () => {
    const predicate = compilePredicate(
      "${{ !has(data.message) && data.labels.exists(l, l.name == 'owner' && l.value == 'alice') }}",
      "categories[0].matchers",
      { data: "map" },
    );

    const owner = { name: "owner", value: "alice" };

    const result = predicate({
      data: { message: undefined, labels: [owner, owner], nullable: null, flaky: false },
    });

    expect(result).toBe(true);
  });

  it.each([{ name: () => true }, { name: new Date() }, { name: Infinity }])(
    "rejects unsupported context data",
    (context) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const predicate = compilePredicate("${{ true }}", "hideLabels[0]", { name: "string" });

      const result = predicate(context);

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects cyclic context with a plain-data diagnostic", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data: Record<string, unknown> = {};
    data.self = data;
    const predicate = compilePredicate("${{ true }}", "categories[0].matchers", { data: "map" });

    const result = predicate({ data });

    expect(result).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "Invalid expression at categories[0].matchers: expression context must contain only finite numbers and plain data",
    );
  });
});
