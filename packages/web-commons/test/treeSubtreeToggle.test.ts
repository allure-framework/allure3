import { label } from "allure-js-commons";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import {
  getSubtreeToggleAction,
  getSubtreeToggleIcon,
  resolveNextSubtreeToggleState,
} from "../src/treeSubtreeToggle.js";
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

describe("getSubtreeToggleAction", () => {
  const state = {
    hasOnlyLeafResults: false,
    isSubtreeCollapsedAll: false,
    isSubtreeFirstLevelOnly: false,
    isSubtreeExpandedAll: false,
    lastSubtreeToggle: null,
  } as const;

  test("expands the first level of the collapsed subtree", () => {
    expect(getSubtreeToggleAction({ ...state, isSubtreeCollapsedAll: true })).toBe("expand-first-level");
  });

  test("expands all levels when the first level is opened and the subtree was not expanded before", () => {
    expect(getSubtreeToggleAction({ ...state, isSubtreeFirstLevelOnly: true })).toBe("expand-all");
  });

  test("collapses the subtree when the first level is opened after all levels were expanded", () => {
    expect(getSubtreeToggleAction({ ...state, isSubtreeFirstLevelOnly: true, lastSubtreeToggle: "all" })).toBe(
      "collapse-all",
    );
  });

  test("collapses to the first level when all levels are expanded", () => {
    expect(getSubtreeToggleAction({ ...state, isSubtreeExpandedAll: true })).toBe("collapse-to-first-level");
  });

  test("expands all levels when a part of them is expanded", () => {
    expect(getSubtreeToggleAction(state)).toBe("expand-all");
  });

  test("expands and collapses the subtree that has only leaf results as a whole", () => {
    expect(getSubtreeToggleAction({ ...state, hasOnlyLeafResults: true, isSubtreeCollapsedAll: true })).toBe(
      "expand-all",
    );
    expect(getSubtreeToggleAction({ ...state, hasOnlyLeafResults: true })).toBe("collapse-all");
  });
});

describe("getSubtreeToggleIcon", () => {
  const state = {
    hasOnlyLeafResults: false,
    isSubtreeCollapsedAll: false,
    isSubtreeFirstLevelOnly: false,
    isSubtreeExpandedAll: false,
    lastSubtreeToggle: null,
  } as const;

  test("points down when the click expands the first level of the collapsed subtree", () => {
    expect(getSubtreeToggleIcon({ ...state, isSubtreeCollapsedAll: true })).toBe("single-down");
  });

  test("points down twice when the click expands all levels from the first level", () => {
    expect(getSubtreeToggleIcon({ ...state, isSubtreeFirstLevelOnly: true })).toBe("double-down");
  });

  test("points down twice when the click expands all levels of the partially expanded subtree", () => {
    expect(getSubtreeToggleIcon(state)).toBe("double-down");
  });

  test("points up twice when the click collapses all levels to the first one", () => {
    expect(getSubtreeToggleIcon({ ...state, isSubtreeExpandedAll: true })).toBe("double-up");
  });

  test("points up when the click collapses the subtree that was collapsed from all levels", () => {
    expect(getSubtreeToggleIcon({ ...state, isSubtreeFirstLevelOnly: true, lastSubtreeToggle: "all" })).toBe(
      "single-up",
    );
  });

  test("uses the single chevrons for the subtree that has only leaf results", () => {
    expect(getSubtreeToggleIcon({ ...state, hasOnlyLeafResults: true, isSubtreeCollapsedAll: true })).toBe(
      "single-down",
    );
    expect(getSubtreeToggleIcon({ ...state, hasOnlyLeafResults: true })).toBe("single-up");
  });
});
