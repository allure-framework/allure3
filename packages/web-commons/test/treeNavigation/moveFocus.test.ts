import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { moveFocus } from "../../src/treeNavigation/moveFocus.js";
import type { FlatTreeNode } from "../../src/treeNavigation/types.js";

const flatList: FlatTreeNode[] = [
  { kind: "group", id: "group-a", nodeId: "group-a", depth: 0, isExpanded: true, hasChildren: true },
  { kind: "leaf", id: "leaf-1", testResultId: "leaf-1", depth: 1, parentId: "group-a" },
  { kind: "leaf", id: "leaf-2", testResultId: "leaf-2", depth: 1, parentId: "group-a" },
];

describe("treeNavigation > moveFocus", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("moves down through visible nodes", () => {
    expect(moveFocus(flatList, "group-a", "down").nextId).toBe("leaf-1");
    expect(moveFocus(flatList, "leaf-1", "down").nextId).toBe("leaf-2");
  });

  test("requests collapse when moving left on expanded group", () => {
    const result = moveFocus(flatList, "group-a", "left");

    expect(result).toEqual({ nextId: "group-a", collapse: true });
  });

  test("jumps to first and last leaves", () => {
    expect(moveFocus(flatList, undefined, "firstLeaf").nextId).toBe("leaf-1");
    expect(moveFocus(flatList, undefined, "lastLeaf").nextId).toBe("leaf-2");
  });

  test("moves to parent without collapsing expanded group", () => {
    expect(moveFocus(flatList, "leaf-1", "parent")).toEqual({ nextId: "group-a" });
    expect(moveFocus(flatList, "group-a", "parent")).toEqual({ nextId: "group-a" });
  });

  test("moves to first child when node is expanded", () => {
    expect(moveFocus(flatList, "group-a", "firstChild").nextId).toBe("leaf-1");
  });

  test("moves up to the last visible node in the previous branch, not the parent header", () => {
    const nestedFlatList: FlatTreeNode[] = [
      { kind: "group", id: "suite", nodeId: "suite", depth: 0, isExpanded: true, hasChildren: true },
      { kind: "leaf", id: "leaf-182", testResultId: "leaf-182", depth: 1, parentId: "suite" },
      {
        kind: "group",
        id: "modern",
        nodeId: "modern",
        depth: 0,
        isExpanded: true,
        hasChildren: true,
        parentId: "root",
      },
    ];

    expect(moveFocus(nestedFlatList, "modern", "up").nextId).toBe("leaf-182");
  });

  test("moves up from the first child to its expanded parent header", () => {
    const nestedFlatList: FlatTreeNode[] = [
      { kind: "env", id: "env:default", nodeId: "default", depth: 0, isExpanded: true, hasChildren: true },
      {
        kind: "group",
        id: "test",
        nodeId: "test",
        depth: 1,
        parentId: "env:default",
        isExpanded: true,
        hasChildren: true,
      },
      {
        kind: "group",
        id: "setup-teardown-debug.spec.ts",
        nodeId: "setup-teardown-debug.spec.ts",
        depth: 2,
        parentId: "test",
        isExpanded: true,
        hasChildren: true,
      },
      {
        kind: "group",
        id: "sandbox",
        nodeId: "sandbox",
        depth: 3,
        parentId: "setup-teardown-debug.spec.ts",
        isExpanded: false,
        hasChildren: true,
      },
      {
        kind: "group",
        id: "fixtures.spec.ts",
        nodeId: "fixtures.spec.ts",
        depth: 2,
        parentId: "test",
        isExpanded: true,
        hasChildren: true,
      },
    ];

    expect(moveFocus(nestedFlatList, "sandbox", "up").nextId).toBe("setup-teardown-debug.spec.ts");
    expect(moveFocus(nestedFlatList, "setup-teardown-debug.spec.ts", "up").nextId).toBe("test");
  });
});
