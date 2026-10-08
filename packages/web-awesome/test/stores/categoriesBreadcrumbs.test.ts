import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import {
  categoriesStore,
  getCategoriesBreadcrumbs,
  pendingCategoryScrollId,
  revealCategoryNode,
} from "@/stores/categories";
import { collapsedTrees } from "@/stores/tree";

beforeEach(async () => {
  await epic("coverage");
  await feature("navigation");
  await story("categoriesBreadcrumbs");
  await label("coverage", "navigation");
});

const nodes = {
  "cat:1": { id: "cat:1", type: "category", name: "Product errors", expand: false, childrenIds: ["group:1"] },
  "group:1": { id: "group:1", type: "group", name: "critical", childrenIds: ["tr-1"] },
  "tr-1": { id: "tr-1", type: "tr", name: "shouldLogin" },
  "cat:2": { id: "cat:2", type: "category", name: "Test errors", expand: true, childrenIds: [] },
};

beforeEach(() => {
  collapsedTrees.value = new Set();
  pendingCategoryScrollId.value = undefined;
  categoriesStore.value = {
    loading: false,
    error: undefined,
    data: { roots: ["cat:2", "cat:1"], nodes } as any,
  };
});

describe("stores > categories > getCategoriesBreadcrumbs", () => {
  it("returns the chain of nodes leading to the test result", () => {
    expect(getCategoriesBreadcrumbs("tr-1")).toEqual([
      { nodeId: "cat:1", name: "Product errors" },
      { nodeId: "group:1", name: "critical" },
    ]);
  });

  it("returns an empty path for an unknown test result", () => {
    expect(getCategoriesBreadcrumbs("missing")).toEqual([]);
    expect(getCategoriesBreadcrumbs(undefined)).toEqual([]);
  });
});

describe("stores > categories > revealCategoryNode", () => {
  it("collapses a category that is closed by default, which flips it open", () => {
    revealCategoryNode(["cat:1", "group:1"]);

    expect(collapsedTrees.value.has("cat:1")).toBe(true);
    expect(collapsedTrees.value.has("group:1")).toBe(false);
  });

  it("un-collapses nodes that are opened by default", () => {
    collapsedTrees.value = new Set(["group:1", "cat:2"]);

    revealCategoryNode(["cat:2", "group:1"]);

    expect(collapsedTrees.value.has("group:1")).toBe(false);
    expect(collapsedTrees.value.has("cat:2")).toBe(false);
  });

  it("marks the last node of the path to be scrolled into view", () => {
    revealCategoryNode(["cat:1", "group:1"]);

    expect(pendingCategoryScrollId.value).toBe("group:1");
  });

  it("does nothing for an empty path", () => {
    revealCategoryNode([]);

    expect(pendingCategoryScrollId.value).toBeUndefined();
    expect(collapsedTrees.value.size).toBe(0);
  });
});
