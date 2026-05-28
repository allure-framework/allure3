import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { getDescendantNodes, getExpandableDescendants } from "../../src/treeNavigation/descendants.js";
import type { FlatTreeNode } from "../../src/treeNavigation/types.js";

const flatList: FlatTreeNode[] = [
  { kind: "env", id: "env:default", nodeId: "default", depth: 0, isExpanded: true, hasChildren: true },
  {
    kind: "group",
    id: "default:group",
    nodeId: "group",
    depth: 1,
    parentId: "env:default",
    isExpanded: true,
    hasChildren: true,
  },
  { kind: "leaf", id: "default:leaf-1", testResultId: "leaf-1", depth: 2, parentId: "default:group" },
  {
    kind: "group",
    id: "default:group-2",
    nodeId: "group-2",
    depth: 2,
    parentId: "default:group",
    isExpanded: false,
    hasChildren: true,
  },
];

describe("treeNavigation > descendants", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("returns nested descendants for a node", () => {
    expect(getDescendantNodes(flatList, "default:group").map((node) => node.id)).toEqual([
      "default:leaf-1",
      "default:group-2",
    ]);
  });

  test("returns only expandable descendants", () => {
    expect(getExpandableDescendants(flatList, "env:default").map((node) => node.id)).toEqual([
      "default:group",
      "default:group-2",
    ]);
  });
});
