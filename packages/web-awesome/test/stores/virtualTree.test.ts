import { epic, feature, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import {
  flattenTreeWithData,
  getDefaultOpenedState,
  type VirtualGroupRow,
  type VirtualLeafRow,
} from "../../src/stores/virtualTree.js";
import type { AwesomeRecursiveTree, AwesomeTreeLeaf } from "../../types.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("virtual-tree");
  await story("flattenTreeWithData");
});

const alwaysOpen = () => true;
const alwaysClosed = () => false;

function makeLeaf(nodeId: string, overrides: Partial<AwesomeTreeLeaf> = {}): AwesomeTreeLeaf {
  return {
    nodeId,
    id: nodeId,
    name: `Test ${nodeId}`,
    status: "passed",
    groupOrder: 1,
    duration: 100,
    start: 0,
    flaky: false,
    retry: false,
    retriesCount: 0,
    transition: undefined,
    ...overrides,
  };
}

function makeTree(
  nodeId: string,
  name: string,
  leaves: AwesomeTreeLeaf[],
  trees: AwesomeRecursiveTree[] = [],
): AwesomeRecursiveTree {
  return {
    nodeId,
    name,
    statistic: { passed: leaves.length, failed: 0, broken: 0, skipped: 0, unknown: 0, total: leaves.length },
    leaves,
    trees,
    duration: 0,
    groupOrder: 0,
  };
}

describe("getDefaultOpenedState", () => {
  it("opens root nodes regardless of statistic", () => {
    const stat = { passed: 10, failed: 0, broken: 0, skipped: 0, unknown: 0, total: 10 };
    expect(getDefaultOpenedState(stat, true)).toBe(true);
  });

  it("opens nodes with failures", () => {
    const stat = { passed: 0, failed: 1, broken: 0, skipped: 0, unknown: 0, total: 1 };
    expect(getDefaultOpenedState(stat, false)).toBe(true);
  });

  it("opens nodes with broken tests", () => {
    const stat = { passed: 0, failed: 0, broken: 2, skipped: 0, unknown: 0, total: 2 };
    expect(getDefaultOpenedState(stat, false)).toBe(true);
  });

  it("collapses nodes with only passed tests", () => {
    const stat = { passed: 5, failed: 0, broken: 0, skipped: 0, unknown: 0, total: 5 };
    expect(getDefaultOpenedState(stat, false)).toBe(false);
  });

  it("opens nodes when statistic is undefined", () => {
    expect(getDefaultOpenedState(undefined, false)).toBe(true);
  });
});

describe("flattenTreeWithData", () => {
  describe("root tree with leaves only", () => {
    it("returns leaf rows at depth 0 when root has no name", () => {
      const tree = makeTree("", "", [makeLeaf("a"), makeLeaf("b")]);
      const rows = flattenTreeWithData(tree, 0, alwaysOpen, { isRoot: true });

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ kind: "leaf", id: "a", depth: 0, nodeId: "a", name: "Test a" });
      expect(rows[1]).toMatchObject({ kind: "leaf", id: "b", depth: 0 });
    });

    it("returns group header + leaves when tree has a name", () => {
      const tree = makeTree("g1", "Suite A", [makeLeaf("l1"), makeLeaf("l2")]);
      const rows = flattenTreeWithData(tree, 0, alwaysOpen);

      expect(rows[0]).toMatchObject({ kind: "group", id: "g1", depth: 0, name: "Suite A", isExpanded: true });
      expect(rows[1]).toMatchObject({ kind: "leaf", depth: 1, nodeId: "l1" });
      expect(rows[2]).toMatchObject({ kind: "leaf", depth: 1, nodeId: "l2" });
    });

    it("collapses children when group is closed", () => {
      const tree = makeTree("g1", "Suite A", [makeLeaf("l1")]);
      const rows = flattenTreeWithData(tree, 0, alwaysClosed);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "group", isExpanded: false });
    });
  });

  describe("nested groups", () => {
    it("assigns increasing depth to nested subtrees", () => {
      const inner = makeTree("inner", "Inner Suite", [makeLeaf("l1")]);
      const outer = makeTree("outer", "Outer Suite", [], [inner]);
      const rows = flattenTreeWithData(outer, 0, alwaysOpen);

      expect(rows[0]).toMatchObject({ kind: "group", id: "outer", depth: 0 });
      expect(rows[1]).toMatchObject({ kind: "group", id: "inner", depth: 1 });
      expect(rows[2]).toMatchObject({ kind: "leaf", id: "l1", depth: 2 });
    });

    it("hides inner children when outer group is collapsed", () => {
      const inner = makeTree("inner", "Inner", [makeLeaf("l1")]);
      const outer = makeTree("outer", "Outer", [], [inner]);
      const rows = flattenTreeWithData(outer, 0, alwaysClosed);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "group", id: "outer" });
    });

    it("shows inner children when outer is open and inner is open", () => {
      const inner = makeTree("inner", "Inner", [makeLeaf("l1")]);
      const outer = makeTree("outer", "Outer", [], [inner]);
      const opened = new Set(["outer", "inner"]);
      const rows = flattenTreeWithData(outer, 0, (id) => opened.has(id));

      expect(rows).toHaveLength(3);
    });

    it("shows inner header but not its children when inner is collapsed", () => {
      const inner = makeTree("inner", "Inner", [makeLeaf("l1")]);
      const outer = makeTree("outer", "Outer", [], [inner]);
      const rows = flattenTreeWithData(outer, 0, (id) => id === "outer");

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ kind: "group", id: "outer", isExpanded: true });
      expect(rows[1]).toMatchObject({ kind: "group", id: "inner", isExpanded: false });
    });
  });

  describe("idPrefix", () => {
    it("scopes leaf and group IDs with prefix", () => {
      const tree = makeTree("g1", "Suite", [makeLeaf("l1")]);
      const rows = flattenTreeWithData(tree, 0, alwaysOpen, { idPrefix: "env1:" });

      expect(rows[0]).toMatchObject({ kind: "group", id: "env1:g1", nodeId: "g1" });
      expect(rows[1]).toMatchObject({ kind: "leaf", id: "env1:l1", nodeId: "l1" });
    });
  });

  describe("leaf data", () => {
    it("copies all leaf fields into VirtualLeafRow", () => {
      const leaf = makeLeaf("l1", {
        name: "My test",
        status: "failed",
        duration: 500,
        groupOrder: 3,
        flaky: true,
        retriesCount: 2,
      });
      const tree = makeTree("", "", [leaf]);
      const rows = flattenTreeWithData(tree, 0, alwaysOpen, { isRoot: true });
      const row = rows[0] as VirtualLeafRow;

      expect(row.name).toBe("My test");
      expect(row.status).toBe("failed");
      expect(row.duration).toBe(500);
      expect(row.groupOrder).toBe(3);
      expect(row.flaky).toBe(true);
      expect(row.retriesCount).toBe(2);
    });
  });

  describe("group data", () => {
    it("carries statistic reference in VirtualGroupRow", () => {
      const stat = { passed: 2, failed: 1, broken: 0, skipped: 0, unknown: 0, total: 3 };
      const tree = { ...makeTree("g1", "Suite", [makeLeaf("l1")]), statistic: stat };
      const rows = flattenTreeWithData(tree, 0, alwaysOpen);
      const row = rows[0] as VirtualGroupRow;

      expect(row.statistic).toBe(stat);
      expect(row.tree).toBe(tree);
    });
  });

  describe("empty tree", () => {
    it("returns empty array for tree with no leaves and no subtrees", () => {
      const tree = makeTree("g1", "Empty", []);
      const rows = flattenTreeWithData(tree, 0, alwaysOpen);
      expect(rows).toHaveLength(0);
    });
  });
});
