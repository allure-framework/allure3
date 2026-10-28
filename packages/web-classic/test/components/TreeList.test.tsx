// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TreeControls } from "../../src/components/HeaderActions/TreeControls.js";
import { TreeList, TreeStoreContext } from "../../src/components/Tree/index.js";
import { statsStore } from "../../src/stores/stats.js";
import { createTreeStore } from "../../src/stores/tree.js";
import type { ReportTree } from "../../types.js";

const { fetchReportJsonData } = vi.hoisted(() => ({ fetchReportJsonData: vi.fn() }));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportJsonData,
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("classic tree");
  await label("coverage", "ui-components");

  statsStore.value = { loading: false, error: undefined, data: { total: 3, passed: 3 } };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  fetchReportJsonData.mockReset();
});

// a passed-only group is collapsed by default (Allure 2 opens failed and broken groups only)
const treeData = {
  root: { groups: ["g1"] },
  groupsById: {
    g1: { nodeId: "g1", name: "group", leaves: ["l1", "l2", "l3"], statistic: { total: 3, passed: 3 } },
  },
  leavesById: {
    l1: { nodeId: "l1", name: "first", status: "passed", flaky: true, duration: 1500 },
    l2: { nodeId: "l2", name: "second", status: "passed", transition: "new" },
    l3: { nodeId: "l3", name: "third", status: "passed", retry: true, retriesCount: 2 },
  },
} as unknown as ReportTree;

const renderTree = async () => {
  fetchReportJsonData.mockResolvedValue(treeData);

  const store = createTreeStore({ id: "suites", widgetFileName: "tree.json", csvFileName: "suites.csv" });

  await store.fetchData();

  render(
    <TreeStoreContext.Provider value={store}>
      <TreeControls />
      <TreeList />
    </TreeStoreContext.Provider>,
  );

  return store;
};

// the root content is always rendered, nested groups add their own content blocks
const openedGroups = () => screen.queryAllByTestId("tree-content").length - 1;

describe("TreeList", () => {
  it("collapses and expands all groups", async () => {
    await renderTree();

    expect(openedGroups()).toBe(0);

    fireEvent.click(screen.getByTestId("tree-expand-all"));
    expect(openedGroups()).toBe(1);
    expect(screen.getAllByTestId("tree-leaf")).toHaveLength(3);

    fireEvent.click(screen.getByTestId("tree-collapse-all"));
    expect(openedGroups()).toBe(0);
    expect(screen.queryAllByTestId("tree-leaf")).toHaveLength(0);
  });

  it("toggles the group status counters", async () => {
    await renderTree();

    expect(screen.getByTestId("tree-header-bar")).toBeTruthy();

    fireEvent.click(screen.getByTestId("tree-toggle-groups-info"));
    expect(screen.queryByTestId("tree-header-bar")).toBeNull();

    fireEvent.click(screen.getByTestId("tree-toggle-groups-info"));
    expect(screen.getByTestId("tree-header-bar")).toBeTruthy();
  });

  it("shows flaky, retries and new marks on leaves", async () => {
    await renderTree();

    fireEvent.click(screen.getByTestId("tree-expand-all"));

    const leaf = (name: string) =>
      screen
        .getAllByTestId("tree-leaf")
        .find((el) => el.querySelector("[data-testid=tree-leaf-title]")?.textContent === name)!;

    expect(leaf("first").querySelector("[data-testid=tree-leaf-flaky]")).toBeTruthy();
    expect(leaf("second").querySelector("[data-testid=tree-leaf-transition-new]")).toBeTruthy();
    expect(leaf("third").querySelector("[data-testid=tree-leaf-retries]")?.textContent).toContain("2");
    expect(leaf("first").querySelector("[data-testid=tree-leaf-retries]")).toBeNull();
  });

  it("scales the group status bar against the tests of the current tree", async () => {
    // the whole report has many more tests than this tree, the only group still holds all tests of the tree
    statsStore.value = { loading: false, error: undefined, data: { total: 300, passed: 300 } };

    await renderTree();

    expect(screen.getByTestId("tree-header-bar").style.minWidth).toBe("140px");
  });

  it("shows no duration for leaves without start and stop", async () => {
    await renderTree();

    fireEvent.click(screen.getByTestId("tree-expand-all"));

    const durations = screen.getAllByTestId("tree-leaf-duration");

    expect(durations).toHaveLength(1);
    expect(durations[0].textContent).not.toContain("unknown");
    expect(
      screen
        .getAllByTestId("tree-leaf")
        .map((leaf) => leaf.textContent)
        .join(" "),
    ).not.toContain("unknown");
  });
});
