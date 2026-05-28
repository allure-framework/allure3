import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { applySubtreeToggleState, collectExpandableSubtreeNodes } from "../src/subtreeExpansion.js";
import type { ExpandableTreeNode } from "../src/subtreeExpansion.js";

const sampleTree: ExpandableTreeNode = {
  nodeId: "root",
  trees: [
    {
      nodeId: "child",
      trees: [{ nodeId: "grand", trees: [], leaves: [{}] }],
      leaves: [],
    },
  ],
  leaves: [],
};

describe("subtreeExpansion", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("collects root and nested groups", () => {
    expect(collectExpandableSubtreeNodes(sampleTree).map((node) => node.id)).toEqual(["root", "child", "grand"]);
  });

  test("apply none collapses every group in subtree", () => {
    const opened = new Set(["root", "child", "grand"]);
    const nodes = collectExpandableSubtreeNodes(sampleTree);

    applySubtreeToggleState(nodes, "none", {
      toScopedId: (id) => id,
      isOpened: (id) => opened.has(id),
      setOpened: (id, shouldOpen) => {
        if (shouldOpen) {
          opened.add(id);
        } else {
          opened.delete(id);
        }
      },
    });

    expect([...opened]).toEqual([]);
  });

  test("apply first opens only root", () => {
    const opened = new Set<string>();
    const nodes = collectExpandableSubtreeNodes(sampleTree);

    applySubtreeToggleState(nodes, "first", {
      toScopedId: (id) => id,
      isOpened: (id) => opened.has(id),
      setOpened: (id, shouldOpen) => {
        if (shouldOpen) {
          opened.add(id);
        } else {
          opened.delete(id);
        }
      },
    });

    expect([...opened]).toEqual(["root"]);
  });

  test("apply all opens every group", () => {
    const opened = new Set<string>();
    const nodes = collectExpandableSubtreeNodes(sampleTree);

    applySubtreeToggleState(nodes, "all", {
      toScopedId: (id) => id,
      isOpened: (id) => opened.has(id),
      setOpened: (id, shouldOpen) => {
        if (shouldOpen) {
          opened.add(id);
        } else {
          opened.delete(id);
        }
      },
    });

    expect([...opened]).toEqual(["root", "child", "grand"]);
  });
});
