import { matchCategory, normalizeCategoriesConfig } from "@allurereport/core-api";
import type { CategoryMatchingData } from "@allurereport/core-api";
import { createNameContext } from "@allurereport/core-api/expression";
import type { Config } from "@allurereport/plugin-api";
import { describe, expect, it } from "vite-plus/test";

import { resolveCategories } from "../../src/config/categories.js";

const nameContext = createNameContext();
const data: CategoryMatchingData = {
  status: "failed",
  flaky: false,
  labels: [{ name: "owner", value: "alice" }],
  message: "connection refused",
  duration: 100,
};

describe("category configuration expressions", () => {
  it.each([undefined, false] as const)("preserves absent or disabled categories", (input) => {
    const resolved = resolveCategories(input, nameContext);

    expect(resolved).toBe(input);
  });

  it.each(["array", "object"])("compiles matcher arrays in the %s configuration shape", (shape) => {
    const callback = (value: CategoryMatchingData) => value.flaky;
    const rules = [
      {
        name: "Connections",
        matchers: [
          { statuses: ["passed"] as const },
          callback,
          "${{ has(data.message) && data.message.matches('connection.*refused') && data.labels.exists(l, l.name == 'owner' && l.value == 'alice') }}",
        ],
        groupBy: ["owner" as const],
        groupByMessage: false,
      },
    ];
    const input: Config["categories"] = shape === "array" ? rules : { rules };

    const categories = normalizeCategoriesConfig(resolveCategories(input, nameContext));
    const matched = matchCategory(categories, data);

    expect(matched?.name).toBe("Connections");
    expect(matched?.groupBy).toEqual(["owner"]);
    expect(matched?.groupByMessage).toBe(false);
    expect(matched?.matchers[1]).toBe(callback);
    expect(typeof rules[0].matchers[2]).toBe("string");
  });

  it.each([
    ["firefox", false],
    ["", true],
  ])("treats missing label values as empty strings when comparing against %j", (value, expected) => {
    const categories = normalizeCategoriesConfig(
      resolveCategories(
        [{ name: "Browser", matchers: `\${{ data.labels.exists(l, l.name == 'browser' && l.value == '${value}') }}` }],
        nameContext,
      ),
    );
    const candidate = { ...data, labels: [{ name: "browser" }] };

    const matched = matchCategory(categories, candidate);

    expect(matched?.name === "Browser").toBe(expected);
  });

  it.each([
    [null, "Invalid categories: expected an object or array"],
    [true, "Invalid categories: expected an object or array"],
    [{ rules: "invalid" }, "Invalid categories.rules: expected an array"],
    [[null], "Invalid categories[0]: expected an object"],
    [{ rules: [null] }, "Invalid categories.rules[0]: expected an object"],
    [[[]], "Invalid categories[0]: expected an object"],
  ])("rejects invalid category structures with their configuration path: %j", (input, message) => {
    const resolve = () => resolveCategories(input as unknown as Config["categories"], nameContext);

    expect(resolve).toThrow(message);
  });

  it("compiles a single predicate and omits absent optional values", () => {
    const input = [
      { name: "No message", matchers: "${{ !has(data.message) && data.duration > 42 && !has(data.secret) }}" },
    ];
    const categories = normalizeCategoriesConfig(resolveCategories(input, nameContext));
    const candidate = { ...data, message: undefined, secret: "not part of the expression context" };

    const matched = matchCategory(categories, candidate);

    expect(matched?.name).toBe("No message");
  });

  it("rejects an unwrapped matcher with its array index", () => {
    const resolve = () =>
      resolveCategories([{ name: "Connections", matchers: [{ message: "unrelated" }, "true"] }], nameContext);

    expect(resolve).toThrow("Invalid expression at categories[0].matchers[1]:");
  });

  it("propagates evaluation errors from category matching", () => {
    const categories = normalizeCategoriesConfig(
      resolveCategories([{ name: "Timeout", matchers: "${{ data.trace.contains('timeout') }}" }], nameContext),
    );

    const match = () => matchCategory(categories, data);

    expect(match).toThrow("Invalid expression at categories[0].matchers:");
  });

  it("retains native regex, object patterns and compatibility matching", () => {
    const categories = normalizeCategoriesConfig(
      resolveCategories(
        [
          { name: "Object", matchers: { message: /^connection/, labels: { owner: "^alice$" } } },
          { name: "Compatibility", messageRegex: "timeout", matchedStatuses: ["broken"] },
        ],
        nameContext,
      ),
    );

    const names = [
      matchCategory(categories, data)?.name,
      matchCategory(categories, { ...data, status: "broken", message: "timeout" })?.name,
    ];

    expect(names).toEqual(["Object", "Compatibility"]);
  });
});
