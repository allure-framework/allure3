import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { flattenVisibleTree } from "../../src/treeNavigation/flattenVisibleTree.js";
import type { FlattenTreeInput } from "../../src/treeNavigation/types.js";

const sampleTree: FlattenTreeInput = {
  nodeId: "root",
  statistic: { total: 2, passed: 2 },
  leaves: [],
  trees: [
    {
      nodeId: "group-a",
      name: "Group A",
      statistic: { total: 2, failed: 1 },
      leaves: [{ nodeId: "leaf-1" }, { nodeId: "leaf-2" }],
      trees: [],
    },
  ],
};

describe("treeNavigation > flattenVisibleTree", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("includes group and leaves when group is expanded by default", () => {
    const flat = flattenVisibleTree({
      collapsedTrees: new Set(),
      tree: sampleTree,
      isRoot: true,
    });

    expect(flat.map((node) => node.id)).toEqual(["group-a", "leaf-1", "leaf-2"]);
  });

  test("hides leaves when group is collapsed", () => {
    const flat = flattenVisibleTree({
      collapsedTrees: new Set(["group-a"]),
      tree: sampleTree,
      isRoot: true,
    });

    expect(flat.map((node) => node.id)).toEqual(["group-a"]);
    expect(flat[0]?.isExpanded).toBe(false);
  });

  test("includes env section nodes when provided", () => {
    const flat = flattenVisibleTree({
      collapsedTrees: new Set(),
      envSections: [
        {
          id: "env-1",
          opened: true,
          statistic: { total: 1, passed: 1 },
          tree: {
            nodeId: "env-root",
            statistic: { total: 1, passed: 1 },
            leaves: [{ nodeId: "leaf-env" }],
            trees: [],
          },
        },
      ],
    });

    expect(flat.map((node) => node.id)).toEqual(["env:env-1", "env-1:leaf-env"]);
  });

  test("prefixes node ids per environment to keep focus ids unique", () => {
    const flat = flattenVisibleTree({
      collapsedTrees: new Set(),
      envSections: [
        {
          id: "default",
          opened: true,
          statistic: { total: 1, passed: 1 },
          tree: {
            nodeId: "test",
            name: "test",
            statistic: { total: 1, passed: 1 },
            leaves: [{ nodeId: "leaf-default" }],
            trees: [],
          },
        },
        {
          id: "foo",
          opened: true,
          statistic: { total: 1, passed: 1 },
          tree: {
            nodeId: "test",
            name: "test",
            statistic: { total: 1, passed: 1 },
            leaves: [{ nodeId: "leaf-foo" }],
            trees: [],
          },
        },
      ],
    });

    expect(flat.map((node) => node.id)).toEqual([
      "env:default",
      "default:test",
      "default:leaf-default",
      "env:foo",
      "foo:test",
      "foo:leaf-foo",
    ]);
  });

  test("uses isGroupOpened when groups default to collapsed", () => {
    const passedGroupTree: FlattenTreeInput = {
      nodeId: "passed-suite",
      name: "Passed suite",
      statistic: { total: 1, passed: 1 },
      leaves: [{ nodeId: "leaf-182" }],
      trees: [],
    };

    const flatWithoutCallback = flattenVisibleTree({
      collapsedTrees: new Set(),
      tree: passedGroupTree,
      isRoot: false,
    });

    expect(flatWithoutCallback.map((node) => node.id)).toEqual(["passed-suite"]);

    const flat = flattenVisibleTree({
      collapsedTrees: new Set(),
      tree: passedGroupTree,
      isRoot: false,
      isGroupOpened: (_scopedId, openedByDefault) => !openedByDefault,
    });

    expect(flat.map((node) => node.id)).toEqual(["passed-suite", "leaf-182"]);
  });

  test("stores openedByDefault on group nodes", () => {
    const flat = flattenVisibleTree({
      collapsedTrees: new Set(),
      tree: sampleTree,
      isRoot: true,
    });

    expect(flat[0]?.openedByDefault).toBe(true);

    const passedGroupTree: FlattenTreeInput = {
      nodeId: "passed-suite",
      name: "Passed suite",
      statistic: { total: 1, passed: 1 },
      leaves: [{ nodeId: "leaf-182" }],
      trees: [],
    };

    const passedFlat = flattenVisibleTree({
      collapsedTrees: new Set(),
      tree: passedGroupTree,
      isRoot: false,
    });

    expect(passedFlat[0]?.openedByDefault).toBe(false);
  });

  test("collapses groups per environment when nodeId is shared", () => {
    const envTree = {
      nodeId: "shared-suite",
      name: "Shared suite",
      statistic: { total: 1, passed: 1 },
      leaves: [{ nodeId: "leaf" }],
      trees: [],
    };

    const flat = flattenVisibleTree({
      collapsedTrees: new Set(["default:shared-suite"]),
      envSections: [
        {
          id: "default",
          opened: true,
          statistic: { total: 1, passed: 1 },
          tree: envTree,
        },
        {
          id: "foo",
          opened: true,
          statistic: { total: 1, passed: 1 },
          tree: envTree,
        },
      ],
    });

    const defaultGroup = flat.find((node) => node.id === "default:shared-suite");
    const fooGroup = flat.find((node) => node.id === "foo:shared-suite");

    expect(defaultGroup?.isExpanded).toBe(false);
    expect(fooGroup?.isExpanded).toBe(true);
    expect(flat.some((node) => node.id === "default:leaf")).toBe(false);
    expect(flat.some((node) => node.id === "foo:leaf")).toBe(true);
  });
});
