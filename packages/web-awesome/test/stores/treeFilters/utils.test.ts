import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { Filters } from "../../../src/stores/treeFilters/model.js";
import { constructFilterParams, hasActiveFilters } from "../../../src/stores/treeFilters/utils.js";

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
      [{ resolution: ["issue"] }, "resolution"],
      [{ transition: ["new"] }, "transition"],
      [{ tags: ["smoke"] }, "tags"],
      [{ categories: ["Product Bug"] }, "categories"],
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
          resolution: [],
          tags: [],
          categories: [],
        }),
      ).toBe(false);
    });
  });

  describe("constructFilterParams", () => {
    it("should write resolution category filter params", () => {
      const params = constructFilterParams({ resolution: ["issue", "muted"] });

      expect(params.getAll("resolution")).toEqual(["issue", "muted"]);
    });
  });
});
