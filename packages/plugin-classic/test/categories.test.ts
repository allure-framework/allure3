import type { CategoryRule, TestResult } from "@allurereport/core-api";
import { normalizeCategoriesConfig } from "@allurereport/core-api";
import type { ReportTestResult } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  NO_MESSAGE_GROUP,
  matchClassicCategories,
  resolveClassicCategories,
  toCategoriesTreeItems,
} from "../src/categories.js";
import type { ClassicCategory } from "../src/model.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("categories");
  await story("categories");
  await label("coverage", "categories");
});

const tr = (overrides: Partial<TestResult> = {}) =>
  ({
    status: "failed",
    flaky: false,
    labels: [],
    ...overrides,
  }) as Pick<TestResult, "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment">;

const defaults = () => resolveClassicCategories(undefined);
const withLegacy = (legacy: ClassicCategory[]) => resolveClassicCategories(undefined, legacy);
const withConfig = (rules: CategoryRule[], legacy: ClassicCategory[] = []) =>
  resolveClassicCategories(normalizeCategoriesConfig(rules), legacy);

describe("resolveClassicCategories", () => {
  it("should provide Allure 2 default categories when nothing is configured", () => {
    expect(defaults().map(({ name }) => name)).toEqual(["Product defects", "Test defects"]);
  });

  it("should put config categories first, then categories.json rules, then defaults", () => {
    const categories = withConfig(
      [{ name: "Config category", matchers: { statuses: ["failed"] } }],
      [{ name: "Legacy category", matchedStatuses: ["broken"] }],
    );

    expect(categories.map(({ name }) => name)).toEqual([
      "Config category",
      "Legacy category",
      "Product defects",
      "Test defects",
    ]);
  });

  it("should prefer the config category when categories.json defines a category with the same name", () => {
    const categories = withConfig(
      [{ name: "Timeouts", matchers: { statuses: ["broken"] } }],
      [{ name: "Timeouts", matchedStatuses: ["failed"] }],
    );

    expect(categories.filter(({ name }) => name === "Timeouts")).toHaveLength(1);
    expect(matchClassicCategories(categories, tr({ status: "failed" }))).toEqual([
      expect.objectContaining({ name: "Product defects" }),
    ]);
  });

  it("should apply no categories when categories are disabled in the config", () => {
    const categories = resolveClassicCategories(normalizeCategoriesConfig(false), [
      { name: "Legacy category", matchedStatuses: ["failed"] },
    ]);

    expect(categories).toEqual([]);
    expect(matchClassicCategories(categories, tr({ status: "failed" }))).toEqual([]);
  });

  it("should keep a custom name of a default category from the config", () => {
    const categories = withConfig([{ id: "_product_errors_default_category", name: "Bugs", matchers: {} }]);

    expect(categories.map(({ name }) => name)).toContain("Bugs");
  });

  it("should match a config override of a default category before categories.json rules and keep its name", () => {
    const categories = withConfig(
      [{ name: "Product errors", matchers: { statuses: ["failed"], message: /timeout/ } }],
      [{ name: "Legacy category", matchedStatuses: ["failed"] }],
    );

    expect(categories.map(({ name }) => name)).toEqual([
      "Product errors",
      "Legacy category",
      "Product errors",
      "Test defects",
    ]);
    expect(
      matchClassicCategories(categories, tr({ status: "failed", error: { message: "connection timeout" } })),
    ).toEqual([
      expect.objectContaining({ name: "Product errors" }),
      expect.objectContaining({ name: "Legacy category" }),
    ]);
  });

  it("should match categories.json rules before the built-in matcher of an overridden default category", () => {
    const categories = withConfig(
      [{ name: "Product errors", matchers: { statuses: ["failed"], message: /timeout/ } }],
      [{ name: "Legacy category", matchedStatuses: ["failed"] }],
    );

    expect(
      matchClassicCategories(categories, tr({ status: "failed", error: { message: "connection refused" } })),
    ).toEqual([expect.objectContaining({ name: "Legacy category" })]);
  });

  it("should keep categories.json rules for broken tests when the default Test errors category is hidden", () => {
    const categories = withConfig(
      [{ name: "Test errors", matchers: { statuses: ["broken"] }, hide: true }],
      [{ name: "Network", matchedStatuses: ["broken"], messageRegex: ".*ECONNREFUSED.*" }],
    );

    expect(
      matchClassicCategories(categories, tr({ status: "broken", error: { message: "connect ECONNREFUSED" } })),
    ).toEqual([expect.objectContaining({ name: "Network" })]);
    expect(matchClassicCategories(categories, tr({ status: "broken", error: { message: "boom" } }))).toEqual([]);
  });

  it("should recognise default categories of a cloned config", () => {
    const cloned = JSON.parse(JSON.stringify(normalizeCategoriesConfig(undefined)));
    const categories = resolveClassicCategories(cloned, [{ name: "Legacy category", matchedStatuses: ["failed"] }]);

    expect(categories.map(({ name }) => name)).toEqual(["Legacy category", "Product defects", "Test defects"]);
  });

  it("should keep categories.json rules named like the default categories", () => {
    const categories = withLegacy([{ name: "Product errors", matchedStatuses: ["failed"], messageRegex: ".*boom.*" }]);

    expect(categories.map(({ name }) => name)).toEqual(["Product errors", "Product defects", "Test defects"]);
    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "boom" } }))).toEqual([
      expect.objectContaining({ name: "Product errors" }),
    ]);
  });

  it("should merge categories.json rules whose names differ only by surrounding spaces", () => {
    const categories = withLegacy([
      { name: "Timeouts", matchedStatuses: ["broken"] },
      { name: "Timeouts ", matchedStatuses: ["failed"], messageRegex: ".*timeout.*" },
    ]);

    expect(categories.map(({ name }) => name)).toEqual(["Timeouts", "Product defects", "Test defects"]);
    expect(matchClassicCategories(categories, tr({ status: "broken" }))).toEqual([
      expect.objectContaining({ name: "Timeouts" }),
    ]);
    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "read timeout" } }))).toEqual([
      expect.objectContaining({ name: "Timeouts" }),
    ]);
  });

  it("should skip only an invalid categories.json rule and keep the valid ones", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const categories = withLegacy([
        { name: "Bad\u0007category", matchedStatuses: ["failed"] },
        { name: "Good category", matchedStatuses: ["failed"] },
      ]);

      expect(categories.map(({ name }) => name)).toEqual(["Good category", "Product defects", "Test defects"]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Bad"), expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("matchClassicCategories", () => {
  it("should put a test into every matching config and categories.json category like Allure 2", () => {
    const categories = withConfig(
      [
        { name: "Config timeouts", matchers: { statuses: ["failed"], message: /timeout/ } },
        { name: "Config failures", matchers: { statuses: ["failed"] } },
      ],
      [
        { name: "Legacy timeouts", matchedStatuses: ["failed"], messageRegex: ".*timeout.*" },
        { name: "Legacy refused", matchedStatuses: ["failed"], messageRegex: ".*refused.*" },
      ],
    );

    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "read timeout" } }))).toEqual([
      expect.objectContaining({ name: "Config timeouts" }),
      expect.objectContaining({ name: "Config failures" }),
      expect.objectContaining({ name: "Legacy timeouts" }),
    ]);
  });

  it("should apply the default fallback only when no other category matched", () => {
    const categories = withLegacy([{ name: "Timeouts", matchedStatuses: ["failed"], messageRegex: ".*timeout.*" }]);

    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "read timeout" } }))).toEqual([
      expect.objectContaining({ name: "Timeouts" }),
    ]);
    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "boom" } }))).toEqual([
      expect.objectContaining({ name: "Product defects" }),
    ]);
  });

  it("should not apply the default fallback when a hidden category matched", () => {
    const categories = withConfig([{ name: "Hidden", hide: true, matchers: { statuses: ["failed"] } }]);

    expect(matchClassicCategories(categories, tr({ status: "failed" }))).toEqual([]);
  });

  it("should match failed tests to Product defects and broken tests to Test defects by default", () => {
    expect(matchClassicCategories(defaults(), tr({ status: "failed" }))).toEqual([
      { id: "_product_errors_default_category", name: "Product defects" },
    ]);
    expect(matchClassicCategories(defaults(), tr({ status: "broken" }))).toEqual([
      { id: "_test_errors_default_category", name: "Test defects" },
    ]);
  });

  it("should not match passed, skipped and unknown tests by default", () => {
    for (const status of ["passed", "skipped", "unknown"] as const) {
      expect(matchClassicCategories(defaults(), tr({ status }))).toEqual([]);
    }
  });

  it("should match categories.json messageRegex against the test error message", () => {
    const categories = withLegacy([{ name: "Assertion errors", messageRegex: ".*expected.*to equal.*" }]);
    const matched = matchClassicCategories(
      categories,
      tr({ status: "failed", error: { message: "AssertionError: expected 1 to equal 2" } }),
    );

    expect(matched).toEqual([expect.objectContaining({ name: "Assertion errors" })]);
  });

  it("should match categories.json messageRegex against a multi-line message", () => {
    const categories = withLegacy([{ name: "Assertion errors", messageRegex: "^Expected.*actual.*$" }]);
    const matched = matchClassicCategories(
      categories,
      tr({ status: "failed", error: { message: "Expected value\n  to be 2\nbut actual is 1" } }),
    );

    expect(matched).toEqual([expect.objectContaining({ name: "Assertion errors" })]);
  });

  it("should require categories.json regexes to match the whole message and trace like Allure 2", () => {
    const categories = withLegacy([
      { name: "Timeouts", messageRegex: "timeout" },
      { name: "Network", traceRegex: "ECONNREFUSED" },
    ]);

    expect(
      matchClassicCategories(
        categories,
        tr({ status: "failed", error: { message: "read timeout occurred", trace: "cause: ECONNREFUSED here" } }),
      ),
    ).toEqual([expect.objectContaining({ name: "Product defects" })]);
    expect(matchClassicCategories(categories, tr({ status: "failed", error: { message: "timeout" } }))).toEqual([
      expect.objectContaining({ name: "Timeouts" }),
    ]);
  });

  it("should match categories.json traceRegex against the test error trace", () => {
    const categories = withLegacy([{ name: "Network", traceRegex: ".*ECONNREFUSED.*" }]);
    const matched = matchClassicCategories(
      categories,
      tr({ status: "broken", error: { message: "fetch failed", trace: "Error: fetch failed\n  cause: ECONNREFUSED" } }),
    );

    expect(matched).toEqual([expect.objectContaining({ name: "Network" })]);
  });

  it("should fall back to the default category when the regex does not match", () => {
    const categories = withLegacy([{ name: "Network", messageRegex: ".*ECONNREFUSED.*" }]);
    const matched = matchClassicCategories(categories, tr({ status: "failed", error: { message: "boom" } }));

    expect(matched).toEqual([expect.objectContaining({ name: "Product defects" })]);
  });

  it("should never match a categories.json rule with an invalid regex", () => {
    const categories = withLegacy([{ name: "Invalid", messageRegex: "(" }]);
    const matched = matchClassicCategories(categories, tr({ status: "failed", error: { message: "(" } }));

    expect(matched).toEqual([expect.objectContaining({ name: "Product defects" })]);
  });

  it("should honour matchedStatuses and flaky of categories.json rules", () => {
    const categories = withLegacy([
      { name: "Flaky failures", matchedStatuses: ["failed"], flaky: true },
      { name: "Ignored", matchedStatuses: ["skipped"] },
    ]);

    expect(matchClassicCategories(categories, tr({ status: "failed", flaky: true }))).toEqual([
      expect.objectContaining({ name: "Flaky failures" }),
    ]);
    expect(matchClassicCategories(categories, tr({ status: "failed", flaky: false }))).toEqual([
      expect.objectContaining({ name: "Product defects" }),
    ]);
    expect(matchClassicCategories(categories, tr({ status: "skipped" }))).toEqual([
      expect.objectContaining({ name: "Ignored" }),
    ]);
  });

  it("should match allurerc categories with message and trace matchers", () => {
    const categories = withConfig([
      { name: "Timeouts", matchers: { message: /timed? ?out/i } },
      { name: "Type errors", matchedStatuses: ["broken"], traceRegex: "TypeError" },
    ]);

    expect(
      matchClassicCategories(categories, tr({ status: "failed", error: { message: "Request timed out after 5s" } })),
    ).toEqual([expect.objectContaining({ name: "Timeouts" })]);
    expect(
      matchClassicCategories(
        categories,
        tr({ status: "broken", error: { message: "x", trace: "TypeError: x is undefined" } }),
      ),
    ).toEqual([expect.objectContaining({ name: "Type errors" })]);
  });

  it("should return every matching category in matching order and leave out hidden ones", () => {
    const categories = withConfig([
      { name: "First", matchers: { statuses: ["failed"] } },
      { name: "Hidden", hide: true, matchers: { statuses: ["failed"] } },
      { name: "Second", matchers: { statuses: ["failed"] } },
    ]);

    expect(matchClassicCategories(categories, tr({ status: "failed" }))).toEqual([
      expect.objectContaining({ name: "First" }),
      expect.objectContaining({ name: "Second" }),
    ]);
  });

  it("should not assign hidden categories", () => {
    const categories = withConfig([{ name: "Hidden", hide: true, matchers: { statuses: ["failed"] } }]);

    expect(matchClassicCategories(categories, tr({ status: "failed" }))).toEqual([]);
  });
});

describe("toCategoriesTreeItems", () => {
  const reportTr = (id: string, overrides: Partial<ReportTestResult> = {}) =>
    ({ id, name: id, status: "failed", categories: [], isRetry: false, ...overrides }) as ReportTestResult;

  it("should leave out tests without a category and retries", () => {
    const items = toCategoriesTreeItems([
      reportTr("passed", { status: "passed" }),
      reportTr("failed", { categories: [{ name: "Product defects" }], error: { message: "boom" } }),
      reportTr("retry", { categories: [{ name: "Product defects" }], isRetry: true }),
    ]);

    expect(items.map(({ id }) => id)).toEqual(["failed"]);
  });

  it("should keep every category of a test for the tree", () => {
    const [item] = toCategoriesTreeItems([
      reportTr("failed", { categories: [{ name: "A" }, { name: "B" }], error: { message: "boom" } }),
    ]);

    expect(item.categories).toEqual([{ name: "A" }, { name: "B" }]);
  });

  it("should group tests without an error message under the No message group", () => {
    const [item] = toCategoriesTreeItems([reportTr("failed", { categories: [{ name: "Product defects" }] })]);

    expect(item.error?.message).toBe(NO_MESSAGE_GROUP);
  });
});
