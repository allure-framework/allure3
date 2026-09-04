import { type ResolutionCategory, type TestStatus, type TestStatusTransition } from "@allurereport/core-api";
import { buildFilterPredicate, setParams } from "@allurereport/web-commons";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { hasActiveTreeFilters, treeNonQueryFilters } from "../../../src/stores/treeFilters/store.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("store");
  await label("coverage", "filters");

  setParams(
    { key: "query", value: undefined },
    { key: "status", value: undefined },
    { key: "retry", value: undefined },
    { key: "flaky", value: undefined },
    { key: "resolution", value: [] },
    { key: "transition", value: [] },
    { key: "tags", value: [] },
    { key: "categories", value: [] },
  );
});

const leaf = (params: {
  status?: TestStatus;
  flaky?: boolean;
  retry?: boolean;
  resolution?: ResolutionCategory;
  transition?: TestStatusTransition;
}) => ({
  nodeId: "node",
  id: "node",
  name: "test",
  duration: 1,
  groupOrder: 1,
  ...params,
});

const matchesActiveFilters = (testLeaf: ReturnType<typeof leaf>) =>
  buildFilterPredicate(treeNonQueryFilters.value)(testLeaf);

describe("stores > treeFilters > store", () => {
  it("should activate resolution category filters from URL params", () => {
    setParams({ key: "resolution", value: ["issue"] });

    expect(hasActiveTreeFilters.value).toBe(true);
    expect(matchesActiveFilters(leaf({ resolution: "issue" }))).toBe(true);
    expect(matchesActiveFilters(leaf({ resolution: "muted" }))).toBe(false);
    expect(matchesActiveFilters(leaf({}))).toBe(false);
  });

  it("should combine resolution category with status as AND", () => {
    setParams({ key: "resolution", value: ["issue"] }, { key: "status", value: "failed" });

    expect(matchesActiveFilters(leaf({ status: "failed", resolution: "issue" }))).toBe(true);
    expect(matchesActiveFilters(leaf({ status: "passed", resolution: "issue" }))).toBe(false);
    expect(matchesActiveFilters(leaf({ status: "failed" }))).toBe(false);
  });

  it("should combine resolution category with retry and flaky markers as OR", () => {
    setParams({ key: "resolution", value: ["issue"] }, { key: "flaky", value: "true" });

    expect(matchesActiveFilters(leaf({ resolution: "issue", flaky: false }))).toBe(true);
    expect(matchesActiveFilters(leaf({ flaky: true }))).toBe(true);
    expect(matchesActiveFilters(leaf({ flaky: false }))).toBe(false);
  });
});
