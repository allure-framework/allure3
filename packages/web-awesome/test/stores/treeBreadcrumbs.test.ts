import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { getTreeBreadcrumbs, treeStore } from "@/stores/tree";

beforeEach(async () => {
  await epic("coverage");
  await feature("navigation");
  await story("treeBreadcrumbs");
  await label("coverage", "navigation");

  setSearch("");
});

const setSearch = (search: string) => {
  window.history.replaceState(null, "", `/${search}`);
  window.dispatchEvent(new Event("replaceState"));
};

const group = (nodeId: string, name: string, children: { groups?: string[]; leaves?: string[] }) => ({
  nodeId,
  name,
  statistic: {},
  ...children,
});

const treeWithNestedLeaf = {
  root: { groups: ["parent"], leaves: [] },
  groupsById: {
    parent: group("parent", "com.example", { groups: ["child"] }),
    child: group("child", "LoginTest", { leaves: ["tr-1"] }),
  },
  leavesById: { "tr-1": { nodeId: "tr-1", name: "shouldLogin", status: "passed" } },
};

const setTrees = (data: Record<string, unknown>) => {
  treeStore.value = { loading: false, error: undefined, data: data as any };
};

describe("stores > tree > getTreeBreadcrumbs", () => {
  beforeEach(() => {
    setTrees({});
  });

  it("returns the chain of groups leading to the leaf", () => {
    setTrees({ default: treeWithNestedLeaf });

    expect(getTreeBreadcrumbs("tr-1")).toEqual([
      { nodeId: "parent", name: "com.example" },
      { nodeId: "child", name: "LoginTest" },
    ]);
  });

  it("returns an empty path for a leaf sitting in the root", () => {
    setTrees({
      default: {
        root: { groups: [], leaves: ["tr-1"] },
        groupsById: {},
        leavesById: { "tr-1": { nodeId: "tr-1", name: "shouldLogin", status: "passed" } },
      },
    });

    expect(getTreeBreadcrumbs("tr-1")).toEqual([]);
  });

  it("looks the leaf up in every environment tree", () => {
    setTrees({
      empty: { root: { groups: [], leaves: [] }, groupsById: {}, leavesById: {} },
      chrome: treeWithNestedLeaf,
    });

    expect(getTreeBreadcrumbs("tr-1")).toEqual([
      { nodeId: "parent", name: "com.example" },
      { nodeId: "child", name: "LoginTest" },
    ]);
  });

  it("returns an empty path when the leaf is filtered out of the tree", () => {
    setTrees({ default: treeWithNestedLeaf });
    setSearch("?status=failed");

    expect(getTreeBreadcrumbs("tr-1")).toEqual([]);
  });

  it("returns an empty path for an unknown test result", () => {
    setTrees({ default: treeWithNestedLeaf });

    expect(getTreeBreadcrumbs("missing")).toEqual([]);
    expect(getTreeBreadcrumbs(undefined)).toEqual([]);
  });
});
