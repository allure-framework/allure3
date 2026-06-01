import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AwesomeTree, AwesomeTreeLeaf } from "../../../../types";
import { environmentsStore } from "../../../src/stores/env";
import { activePane, treeFocusId } from "../../../src/stores/keyboard";
import {
  applyTestResultOverviewNavigation,
  applyTreeNavigation,
  getHotkeyScope,
  goToNextTestResult,
  goToPrevTestResult,
  navigateDownInTestResultPane,
  navigateUpInTestResultPane,
  toggleMetadataSection,
} from "../../../src/stores/keyboardActions";
import { layoutStore } from "../../../src/stores/layout";
import { testResultFocusId } from "../../../src/stores/testResultOverviewNav";
import { testResultNavStore, testResultStore } from "../../../src/stores/testResults";
import { collapsedTrees, treeStore } from "../../../src/stores/tree";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setHash = (hash: string) => {
  window.history.pushState(null, "", hash ? `#${hash}` : "/");
  window.dispatchEvent(new Event("pushState"));
};

const setNav = (ids: string[]) => {
  testResultNavStore.value = { loading: false, error: undefined, data: ids };
};

const makeLeaf = (id: string, order = 0): AwesomeTreeLeaf => ({
  nodeId: id,
  id,
  name: `Test ${id}`,
  status: "passed",
  duration: 100,
  start: order * 1000,
  groupOrder: order,
  flaky: false,
  transition: false,
  retry: false,
  retriesCount: 0,
});

const setupTree = (leafIds: string[]) => {
  environmentsStore.value = {
    loading: false,
    error: undefined,
    data: [{ id: "default", name: "default" }],
  };
  treeStore.value = {
    loading: false,
    error: undefined,
    data: {
      default: {
        root: { groups: [], leaves: leafIds },
        leavesById: Object.fromEntries(leafIds.map((id, i) => [id, makeLeaf(id, i)])),
        groupsById: {},
      } as AwesomeTree,
    },
  };
};

const resetAll = () => {
  setHash("");
  activePane.value = "tree";
  layoutStore.value = "base";
  treeFocusId.value = undefined;
  testResultFocusId.value = undefined;
  testResultNavStore.value = { loading: true, error: undefined, data: undefined };
  testResultStore.value = { loading: true, error: undefined, data: undefined };
  treeStore.value = { loading: true, error: undefined, data: undefined };
  environmentsStore.value = { loading: false, error: undefined, data: [] };
};

// ---------------------------------------------------------------------------
// goToNextTestResult
// ---------------------------------------------------------------------------

describe("goToNextTestResult", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("[base] does nothing when no test result is open", () => {
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("");
  });

  it("[base] does nothing when nav list is empty", () => {
    setHash("tr-1");
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-1");
  });

  it("[base] does nothing when current result is last in the list", () => {
    setHash("tr-3");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-3");
  });

  it("[base] navigates to next test result", () => {
    setHash("tr-1");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-2");
  });

  it("[base] navigates to next test result from middle of list", () => {
    setHash("tr-2");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-3");
  });

  it("[base] preserves non-overview tab when navigating", () => {
    setHash("tr-1/history");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-2/history");
  });

  it("[base] clears treeFocusId after navigating", () => {
    setHash("tr-1");
    setNav(["tr-1", "tr-2"]);
    treeFocusId.value = "tr-1";
    goToNextTestResult();
    expect(treeFocusId.value).toBeUndefined();
  });

  it("[base] does not clear treeFocusId when no-op (last in list)", () => {
    setHash("tr-3");
    setNav(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    goToNextTestResult();
    expect(treeFocusId.value).toBe("tr-3");
  });

  it("[split] does nothing when no test result is open", () => {
    layoutStore.value = "split";
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("");
  });

  it("[split] does nothing when current result is not in visible tree", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-99");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-99");
  });

  it("[split] navigates to next test result in tree order", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-1");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-2");
  });

  it("[split] does nothing when current result is last visible", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-3");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToNextTestResult();
    expect(window.location.hash).toBe("#tr-3");
  });
});

// ---------------------------------------------------------------------------
// goToPrevTestResult
// ---------------------------------------------------------------------------

describe("goToPrevTestResult", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("[base] does nothing when no test result is open", () => {
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("");
  });

  it("[base] does nothing when current result is first in the list", () => {
    setHash("tr-1");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-1");
  });

  it("[base] navigates to previous test result", () => {
    setHash("tr-3");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-2");
  });

  it("[base] navigates to previous test result from middle of list", () => {
    setHash("tr-2");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-1");
  });

  it("[base] preserves non-overview tab when navigating", () => {
    setHash("tr-3/retries");
    setNav(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-2/retries");
  });

  it("[base] clears treeFocusId after navigating", () => {
    setHash("tr-3");
    setNav(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    goToPrevTestResult();
    expect(treeFocusId.value).toBeUndefined();
  });

  it("[base] does not clear treeFocusId when no-op (first in list)", () => {
    setHash("tr-1");
    setNav(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    goToPrevTestResult();
    expect(treeFocusId.value).toBe("tr-1");
  });

  it("[split] navigates to previous test result in tree order", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-3");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-2");
  });

  it("[split] does nothing when current result is first visible", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-1");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    goToPrevTestResult();
    expect(window.location.hash).toBe("#tr-1");
  });
});

// ---------------------------------------------------------------------------
// navigateDownInTestResultPane (ArrowDown / j)
// ---------------------------------------------------------------------------

describe("navigateDownInTestResultPane", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("does nothing when no test result is open", () => {
    setNav(["tr-1", "tr-2"]);
    navigateDownInTestResultPane();
    expect(window.location.hash).toBe("");
  });

  it("navigates to next test result on non-overview tab", () => {
    setHash("tr-1/history");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateDownInTestResultPane();
    expect(window.location.hash).toBe("#tr-2/history");
  });

  it("navigates to next test result on overview tab", () => {
    setHash("tr-1");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateDownInTestResultPane();
    expect(window.location.hash).toBe("#tr-2");
  });

  it("does nothing when current result is last in list", () => {
    setHash("tr-3/history");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateDownInTestResultPane();
    expect(window.location.hash).toBe("#tr-3/history");
  });
});

// ---------------------------------------------------------------------------
// navigateUpInTestResultPane (ArrowUp / k)
// ---------------------------------------------------------------------------

describe("navigateUpInTestResultPane", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("does nothing when no test result is open", () => {
    setNav(["tr-1", "tr-2"]);
    navigateUpInTestResultPane();
    expect(window.location.hash).toBe("");
  });

  it("navigates to previous test result on non-overview tab", () => {
    setHash("tr-3/history");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateUpInTestResultPane();
    expect(window.location.hash).toBe("#tr-2/history");
  });

  it("navigates to previous test result on overview tab", () => {
    setHash("tr-2");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateUpInTestResultPane();
    expect(window.location.hash).toBe("#tr-1");
  });

  it("does nothing when current result is first in list", () => {
    setHash("tr-1/history");
    setNav(["tr-1", "tr-2", "tr-3"]);
    navigateUpInTestResultPane();
    expect(window.location.hash).toBe("#tr-1/history");
  });
});

// ---------------------------------------------------------------------------
// switching base → split: focus current test in tree
// ---------------------------------------------------------------------------

describe("switching to split mode focuses current test in tree", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("sets treeFocusId to current test result when test is visible in tree", () => {
    setHash("tr-2");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    // switch base → split
    layoutStore.value = "split";
    expect(treeFocusId.value).toBe("tr-2");
  });

  it("does nothing when no test result is open", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    layoutStore.value = "split";
    expect(treeFocusId.value).not.toBe("tr-2");
  });

  it("does not re-expand or re-focus when already in split mode", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-1");
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    layoutStore.value = "split";
    expect(treeFocusId.value).toBe("tr-3");
  });
});

// ---------------------------------------------------------------------------
// getHotkeyScope
// ---------------------------------------------------------------------------

describe("getHotkeyScope", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("returns 'tree' at root URL with tree pane active", () => {
    activePane.value = "tree";
    expect(getHotkeyScope()).toBe("tree");
  });

  it("returns 'tree' at root URL with testResult pane active (no open test result)", () => {
    activePane.value = "testResult";
    expect(getHotkeyScope()).toBe("tree");
  });

  it("returns 'testResult' when viewing a test result (non-split, testResult pane active)", () => {
    setHash("tr-1");
    activePane.value = "testResult";
    expect(getHotkeyScope()).toBe("testResult");
  });

  it("returns 'global' when viewing a test result with tree pane active (non-split)", () => {
    setHash("tr-1");
    activePane.value = "tree";
    expect(getHotkeyScope()).toBe("global");
  });

  it("returns 'tree' in split mode with tree pane active", () => {
    layoutStore.value = "split";
    activePane.value = "tree";
    expect(getHotkeyScope()).toBe("tree");
  });

  it("returns 'testResult' in split mode with testResult pane active", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    expect(getHotkeyScope()).toBe("testResult");
  });

  it("returns 'tree' in split mode regardless of open test result", () => {
    setHash("tr-1");
    layoutStore.value = "split";
    activePane.value = "tree";
    expect(getHotkeyScope()).toBe("tree");
  });
});

// ---------------------------------------------------------------------------
// applyTreeNavigation
// ---------------------------------------------------------------------------

describe("applyTreeNavigation", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("does nothing outside tree context (on test result route, non-split)", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    setHash("tr-1");
    applyTreeNavigation("down");
    expect(treeFocusId.value).toBe("tr-1");
  });

  it("moves focus down through tree leaves", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    applyTreeNavigation("down");
    expect(treeFocusId.value).toBe("tr-2");
  });

  it("moves focus down again to third leaf", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-2";
    applyTreeNavigation("down");
    expect(treeFocusId.value).toBe("tr-3");
  });

  it("stays on last leaf when moving down past end", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    applyTreeNavigation("down");
    expect(treeFocusId.value).toBe("tr-3");
  });

  it("moves focus up through tree leaves", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    applyTreeNavigation("up");
    expect(treeFocusId.value).toBe("tr-2");
  });

  it("stays on first leaf when moving up past start", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    applyTreeNavigation("up");
    expect(treeFocusId.value).toBe("tr-1");
  });

  it("moves focus to first leaf with 'home'", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-3";
    applyTreeNavigation("home");
    expect(treeFocusId.value).toBe("tr-1");
  });

  it("moves focus to last leaf with 'end'", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    applyTreeNavigation("end");
    expect(treeFocusId.value).toBe("tr-3");
  });

  it("moves focus to first leaf with 'firstLeaf'", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-2";
    applyTreeNavigation("firstLeaf");
    expect(treeFocusId.value).toBe("tr-1");
  });

  it("moves focus to last leaf with 'lastLeaf'", () => {
    setupTree(["tr-1", "tr-2", "tr-3"]);
    treeFocusId.value = "tr-1";
    applyTreeNavigation("lastLeaf");
    expect(treeFocusId.value).toBe("tr-3");
  });
});

// ---------------------------------------------------------------------------
// applyTestResultOverviewNavigation
// ---------------------------------------------------------------------------

describe("applyTestResultOverviewNavigation", () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it("does nothing when not on overview tab (history tab)", () => {
    setHash("tr-1/history");
    setNav(["tr-1", "tr-2"]);
    testResultFocusId.value = "step-1";
    applyTestResultOverviewNavigation("down");
    expect(testResultFocusId.value).toBe("step-1");
    expect(window.location.hash).toBe("#tr-1/history");
  });

  it("does nothing when not on overview tab (retries tab)", () => {
    setHash("tr-1/retries");
    testResultFocusId.value = "step-2";
    applyTestResultOverviewNavigation("up");
    expect(testResultFocusId.value).toBe("step-2");
    expect(window.location.hash).toBe("#tr-1/retries");
  });

  it("does nothing when no test result is open", () => {
    applyTestResultOverviewNavigation("down");
    expect(testResultFocusId.value).toBeUndefined();
  });

  it("on overview tab with no test data: focus stays undefined (empty flat overview)", () => {
    setHash("tr-1");
    testResultFocusId.value = undefined;
    applyTestResultOverviewNavigation("down");
    expect(testResultFocusId.value).toBeUndefined();
    expect(window.location.hash).toBe("#tr-1");
  });
});

// ---------------------------------------------------------------------------
// toggleMetadataSection (l / p / i in testResult scope)
// ---------------------------------------------------------------------------

describe("toggleMetadataSection", () => {
  beforeEach(() => {
    resetAll();
    collapsedTrees.value = new Set();
  });
  afterEach(() => {
    collapsedTrees.value = new Set();
    resetAll();
  });

  it("does nothing when no test result is open", () => {
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(false);
  });

  it("does nothing on a non-overview tab (history)", () => {
    setHash("tr-1/history");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(false);
  });

  it("does nothing on a non-overview tab (retries)", () => {
    setHash("tr-1/retries");
    toggleMetadataSection("links");
    expect(collapsedTrees.value.has("tr-1-links")).toBe(false);
  });

  it("collapses labels section on first toggle", () => {
    setHash("tr-1");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(true);
  });

  it("re-opens labels section on second toggle", () => {
    setHash("tr-1");
    toggleMetadataSection("labels");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(false);
  });

  it("collapses links section", () => {
    setHash("tr-1");
    toggleMetadataSection("links");
    expect(collapsedTrees.value.has("tr-1-links")).toBe(true);
  });

  it("collapses parameters section", () => {
    setHash("tr-1");
    toggleMetadataSection("parameters");
    expect(collapsedTrees.value.has("tr-1-parameters")).toBe(true);
  });

  it("does not affect a different section's state", () => {
    setHash("tr-1");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-links")).toBe(false);
    expect(collapsedTrees.value.has("tr-1-parameters")).toBe(false);
  });

  it("does nothing in split mode when testResult pane is not focused", () => {
    layoutStore.value = "split";
    activePane.value = "tree";
    setHash("tr-1");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(false);
  });

  it("toggles labels in split mode when testResult pane is focused", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-1");
    toggleMetadataSection("labels");
    expect(collapsedTrees.value.has("tr-1-labels")).toBe(true);
  });

  it("toggles links in split mode when testResult pane is focused", () => {
    layoutStore.value = "split";
    activePane.value = "testResult";
    setHash("tr-1");
    toggleMetadataSection("links");
    expect(collapsedTrees.value.has("tr-1-links")).toBe(true);
  });
});
