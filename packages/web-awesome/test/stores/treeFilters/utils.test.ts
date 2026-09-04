import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { AwesomeFilter, Filters } from "../../../src/stores/treeFilters/model.js";
import {
  constructFilterParams,
  hasActiveFilters,
  isSeverityFilter,
  validateSeverity,
} from "../../../src/stores/treeFilters/utils.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("utils");
  await label("coverage", "filters");
});

describe("stores > treeFilters > utils", () => {
  describe("hasActiveFilters", () => {
    const defaultFilters: Filters = {};

    it("should return false when no filters are active", () => {
      expect(hasActiveFilters(defaultFilters)).toBe(false);
    });

    it.each<[Partial<Filters>, string]>([
      [{ query: "login" }, "query"],
      [{ status: "failed" }, "status"],
      [{ flaky: true }, "flaky"],
      [{ retry: true }, "retry"],
      [{ transition: ["new"] }, "transition"],
      [{ tags: ["smoke"] }, "tags"],
      [{ categories: ["Product Bug"] }, "categories"],
      [{ severity: ["blocker"] }, "severity"],
      [{ severity: ["none"] }, "severity"],
    ])("should return true when %s filter is active", (filters) => {
      expect(hasActiveFilters({ ...defaultFilters, ...filters })).toBe(true);
    });

    it("should ignore blank query values", () => {
      expect(hasActiveFilters({ query: "   " })).toBe(false);
    });

    it("should ignore empty array filters", () => {
      expect(
        hasActiveFilters({
          transition: [],
          tags: [],
          categories: [],
          severity: [],
        }),
      ).toBe(false);
    });
  });

  describe("validateSeverity", () => {
    it.each(["blocker", "critical", "normal", "minor", "trivial", "none"])(
      "should accept the known severity value %s",
      (severity) => {
        expect(validateSeverity(severity)).toBe(true);
      },
    );

    it.each(["", "urgent", "Blocker", "NONE"])("should reject the unknown severity value %s", (severity) => {
      expect(validateSeverity(severity)).toBe(false);
    });
  });

  describe("isSeverityFilter", () => {
    const severityFilter: AwesomeFilter = {
      type: "group",
      logicalOperator: "AND",
      fieldKey: "severity",
      value: [
        {
          type: "field",
          value: { key: "severity", value: "blocker", type: "string", strict: true },
          logicalOperator: "OR",
        },
      ],
    };

    it("should detect the severity filter group", () => {
      expect(isSeverityFilter(severityFilter)).toBe(true);
    });

    it("should not detect other filter groups", () => {
      expect(isSeverityFilter({ ...severityFilter, fieldKey: "transition" })).toBe(false);
    });

    it("should not detect plain field filters", () => {
      expect(
        isSeverityFilter({
          type: "field",
          logicalOperator: "AND",
          value: { key: "severity", value: "blocker", type: "string", strict: true },
        }),
      ).toBe(false);
    });
  });

  describe("constructFilterParams", () => {
    it("should serialize severity values", () => {
      const params = constructFilterParams({ severity: ["blocker", "none"] });

      expect(params.getAll("severity")).toEqual(["blocker", "none"]);
    });
  });
});
