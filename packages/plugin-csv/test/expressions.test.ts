import type { TestResult } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";

import { resolveCsvAccessor, resolveCsvComparator } from "../src/expressions.js";

const row = (value: Partial<TestResult> = {}) => value as TestResult;
const context = (path: string) => ({ path, env: { SUFFIX: "-selected" } });

describe("CSV expressions", () => {
  it("preserves property-name accessors", () => {
    const accessor = resolveCsvAccessor("name", context("fields[0].accessor"));

    expect(accessor).toBe("name");
  });

  it("projects text with the captured environment and maps null to empty cells", () => {
    const accessor = resolveCsvAccessor(
      "${{ has(test.name) ? dyn(test.name + env.SUFFIX) : null }}",
      context("fields[0].accessor"),
    );
    if (typeof accessor !== "function") {
      throw new Error("expected a compiled accessor");
    }

    const cells = [accessor(row({ name: "first" })), accessor(row())];

    expect(cells).toEqual(["first-selected", undefined]);
  });

  it("rejects non-text cells with the configured path", () => {
    const accessor = resolveCsvAccessor("${{ test.duration }}", context("fields[0].accessor"));
    if (typeof accessor !== "function") {
      throw new Error("expected a compiled accessor");
    }

    const evaluate = () => accessor(row({ duration: 12 }));

    expect(evaluate).toThrow("Invalid expression at fields[0].accessor: CSV accessor must return a string or null");
  });

  it.each(["${{ a.duration - b.duration }}", "${{ double(a.duration) - double(b.duration) }}"])(
    "sorts numerically using %s",
    (source) => {
      const compare = resolveCsvComparator(source, context("sort"));
      const rows = [row({ duration: 12 }), row({ duration: 3 }), row({ duration: 12 })];

      const ordered = [...rows].sort(compare);

      expect(ordered).toEqual([rows[1], rows[0], rows[2]]);
      expect(compare(rows[0], rows[2])).toBe(0);
    },
  );

  it("converts unsigned CEL integers to JavaScript numbers", () => {
    const compare = resolveCsvComparator("${{ 1u }}", context("sort"));

    const comparison = compare(row(), row());

    expect(comparison).toBe(1);
  });

  it.each(["${{ 9007199254740992 }}", "${{ double(a.name) }}", "${{ 'wrong' }}"])(
    "rejects unusable comparator results from %s",
    (source) => {
      const compare = resolveCsvComparator(source, context("sort"));

      const evaluate = () => compare(row({ name: "Infinity" }), row());

      expect(evaluate).toThrow(
        "Invalid expression at sort: CSV comparator must return a finite, safely representable number",
      );
    },
  );
});
