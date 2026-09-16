import { beforeEach, describe, expect, it } from "vitest";

import { statsByEnvStore } from "../../src/stores";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "../../src/stores/env";
import {
  allTreesCollapsed,
  collapsedTrees,
  expandedTrees,
  hasCollapsibleTrees,
  isTreeOpened,
  setAllTreesOpened,
  treeStore,
} from "../../src/stores/tree";
import { flatVirtualRows } from "../../src/stores/virtualTree";
import type { ReportTree, ReportTreeLeaf } from "../../types";

const makeLeaf = (id: string, status: "passed" | "failed" = "passed"): ReportTreeLeaf =>
  ({
    nodeId: id,
    id,
    name: `Test ${id}`,
    status,
    duration: 100,
    start: 0,
    groupOrder: 0,
    flaky: false,
    transition: false,
    retry: false,
    retriesCount: 0,
  }) as ReportTreeLeaf;

const passedStatistic = { total: 1, passed: 1 };
const failedStatistic = { total: 1, failed: 1 };

const makeEnvTree = (prefix: string): ReportTree =>
  ({
    root: { groups: [`${prefix}-passed`, `${prefix}-failed`], leaves: [] },
    leavesById: {
      [`${prefix}-leaf-1`]: makeLeaf(`${prefix}-leaf-1`),
      [`${prefix}-leaf-2`]: makeLeaf(`${prefix}-leaf-2`, "failed"),
    },
    groupsById: {
      [`${prefix}-passed`]: {
        nodeId: `${prefix}-passed`,
        name: "passed suite",
        statistic: passedStatistic,
        leaves: [`${prefix}-leaf-1`],
      },
      [`${prefix}-failed`]: {
        nodeId: `${prefix}-failed`,
        name: "failed suite",
        statistic: failedStatistic,
        groups: [`${prefix}-nested`],
      },
      [`${prefix}-nested`]: {
        nodeId: `${prefix}-nested`,
        name: "nested suite",
        statistic: failedStatistic,
        leaves: [`${prefix}-leaf-2`],
      },
    },
  }) as unknown as ReportTree;

const setEnvironments = (ids: string[]) => {
  environmentsStore.value = {
    loading: false,
    error: undefined,
    data: ids.map((id) => ({ id, name: id })),
  };
  treeStore.value = {
    loading: false,
    error: undefined,
    data: Object.fromEntries(ids.map((id) => [id, makeEnvTree(id)])),
  };
  statsByEnvStore.value = {
    loading: false,
    error: undefined,
    data: Object.fromEntries(ids.map((id) => [id, { total: 2, passed: 1, failed: 1 }])),
  };
};

beforeEach(() => {
  collapsedTrees.value = new Set();
  expandedTrees.value = new Set();
  collapsedEnvironments.value = [];
  currentEnvironment.value = "";
});

describe("stores > tree > collapse all", () => {
  it("has nothing to collapse when there are no groups", () => {
    environmentsStore.value = { loading: false, error: undefined, data: [{ id: "default", name: "default" }] };
    treeStore.value = {
      loading: false,
      error: undefined,
      data: {
        default: {
          root: { groups: [], leaves: ["leaf-1"] },
          leavesById: { "leaf-1": makeLeaf("leaf-1") },
          groupsById: {},
        } as ReportTree,
      },
    };

    expect(hasCollapsibleTrees.value).toBe(false);
  });

  it("collapses and expands every group of a single environment", () => {
    setEnvironments(["default"]);

    expect(hasCollapsibleTrees.value).toBe(true);
    expect(allTreesCollapsed.value).toBe(false);

    setAllTreesOpened(false);

    expect(allTreesCollapsed.value).toBe(true);
    expect(isTreeOpened("default-passed", false)).toBe(false);
    expect(isTreeOpened("default-failed", true)).toBe(false);
    expect(isTreeOpened("default-nested", true)).toBe(false);

    setAllTreesOpened(true);

    expect(allTreesCollapsed.value).toBe(false);
    expect(isTreeOpened("default-passed", false)).toBe(true);
    expect(isTreeOpened("default-failed", true)).toBe(true);
    expect(isTreeOpened("default-nested", true)).toBe(true);
  });

  it("keeps the headerless root opened so the tree never disappears", () => {
    setEnvironments(["default"]);
    setAllTreesOpened(false);

    expect(collapsedTrees.value.has("default")).toBe(false);
  });

  it("collapses groups of every environment and the environment sections themselves", () => {
    setEnvironments(["env-a", "env-b"]);

    setAllTreesOpened(false);

    expect(collapsedEnvironments.value).toEqual(["env-a", "env-b"]);
    expect(isTreeOpened("env-a:env-a-failed", true)).toBe(false);
    expect(isTreeOpened("env-b:env-b-nested", true)).toBe(false);
    expect(allTreesCollapsed.value).toBe(true);

    setAllTreesOpened(true);

    expect(collapsedEnvironments.value).toEqual([]);
    expect(isTreeOpened("env-a:env-a-passed", false)).toBe(true);
    expect(allTreesCollapsed.value).toBe(false);
  });

  it("writes unscoped ids and leaves environment sections alone when one environment is selected", () => {
    setEnvironments(["env-a", "env-b"]);
    currentEnvironment.value = "env-a";

    setAllTreesOpened(false);

    expect(collapsedEnvironments.value).toEqual([]);
    expect(isTreeOpened("env-a-failed", true)).toBe(false);
    expect(isTreeOpened("env-a:env-a-failed", true)).toBe(true);
    expect(allTreesCollapsed.value).toBe(true);
  });

  it.each([
    ["a single environment", ["default"], ""],
    ["a selected environment", ["env-a", "env-b"], "env-a"],
    ["all environments", ["env-a", "env-b"], ""],
    ["a selected environment with no tree", ["env-a", "env-b"], "env-missing"],
  ])("leaves no expanded group in the rendered rows: %s", (_name, envIds, selected) => {
    setEnvironments(envIds as string[]);
    currentEnvironment.value = selected as string;

    setAllTreesOpened(false);

    collapsedEnvironments.value = [];

    const expandedGroups = flatVirtualRows.value
      .filter((row) => row.kind === "group" && row.isExpanded)
      .map((row) => row.id);

    expect(expandedGroups).toEqual([]);

    setAllTreesOpened(true);

    const collapsedGroups = flatVirtualRows.value
      .filter((row) => row.kind === "group" && !row.isExpanded)
      .map((row) => row.id);

    expect(collapsedGroups).toEqual([]);
  });
});
