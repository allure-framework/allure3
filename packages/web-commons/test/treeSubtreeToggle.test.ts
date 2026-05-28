import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vitest";

import { resolveNextSubtreeToggleState } from "../src/treeSubtreeToggle.js";
import type { SubtreeNodeState } from "../src/treeSubtreeToggle.js";

const nodes: SubtreeNodeState[] = [
  { id: "root", openedByDefault: true, isRoot: true },
  { id: "child", openedByDefault: true, isRoot: false },
];

describe("treeSubtreeToggle > resolveNextSubtreeToggleState", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  test("cycles collapsed to first level", () => {
    const opened = new Set<string>();

    const { nextState } = resolveNextSubtreeToggleState(nodes, (id) => opened.has(id), null);

    expect(nextState).toBe("first");
  });

  test("cycles first level to all", () => {
    const opened = new Set(["root"]);

    const { nextState } = resolveNextSubtreeToggleState(nodes, (id) => opened.has(id), null);

    expect(nextState).toBe("all");
  });

  test("cycles fully expanded to first level", () => {
    const opened = new Set(["root", "child"]);

    const { nextState } = resolveNextSubtreeToggleState(nodes, (id) => opened.has(id), "all");

    expect(nextState).toBe("first");
  });
});
