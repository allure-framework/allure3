import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { currentEnvironment } from "@/stores/env";
import { filteredTree, getTreeBreadcrumbs, treeStore } from "@/stores/tree";

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
    currentEnvironment.value = "";
  });

  it("uses the compacted group row as the breadcrumb for a single-child chain", () => {
    setTrees({ default: treeWithNestedLeaf });

    expect(filteredTree.value.default?.trees).toMatchObject([
      {
        nodeId: "parent",
        name: "com.example > LoginTest",
        statistic: { passed: 1, total: 1 },
        leaves: [{ nodeId: "tr-1", name: "shouldLogin" }],
        trees: [],
      },
    ]);
    expect(getTreeBreadcrumbs("tr-1")).toEqual([
      { environmentId: "default", nodeId: "parent", name: "com.example > LoginTest" },
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
      { environmentId: "chrome", nodeId: "parent", name: "com.example > LoginTest" },
    ]);
  });

  it("returns no tree breadcrumbs for a result outside the selected environment", () => {
    setTrees({
      chrome: treeWithNestedLeaf,
      firefox: { root: { groups: [], leaves: [] }, groupsById: {}, leavesById: {} },
    });
    currentEnvironment.value = "firefox";

    expect(getTreeBreadcrumbs("tr-1")).toEqual([]);
  });

  it("keeps branches and groups with direct tests separate when those siblings are filtered out", () => {
    setTrees({
      default: {
        ...treeWithNestedLeaf,
        groupsById: {
          parent: group("parent", "com.example", { groups: ["child", "sibling"] }),
          child: group("child", "LoginTest", { groups: ["cases"], leaves: ["tr-2"] }),
          cases: group("cases", "Nested cases", { leaves: ["tr-1"] }),
          sibling: group("sibling", "OtherTest", { leaves: ["tr-3"] }),
        },
        leavesById: {
          ...treeWithNestedLeaf.leavesById,
          "tr-2": { nodeId: "tr-2", name: "shouldLogOut", status: "failed" },
          "tr-3": { nodeId: "tr-3", name: "shouldRegister", status: "failed" },
        },
      },
    });
    setSearch("?status=passed");

    expect(filteredTree.value.default?.statistic).toMatchObject({ passed: 1, total: 1 });
    expect(getTreeBreadcrumbs("tr-1")).toEqual([
      { environmentId: "default", nodeId: "parent", name: "com.example" },
      { environmentId: "default", nodeId: "child", name: "LoginTest" },
      { environmentId: "default", nodeId: "cases", name: "Nested cases" },
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
