// @vitest-environment jsdom
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createTreeStore, treeGroupsInfoStorageKey, treeSortStorageKey } from "../../src/stores/tree.js";
import type { ReportTree } from "../../types.js";

const { fetchReportJsonData } = vi.hoisted(() => ({ fetchReportJsonData: vi.fn() }));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportJsonData,
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("tree store");
  await label("coverage", "filters");
});

afterEach(() => {
  localStorage.clear();
  fetchReportJsonData.mockReset();
});

const treeData = {
  root: { groups: ["g1"] },
  groupsById: {
    g1: { nodeId: "g1", name: "group", leaves: ["l1", "l2", "l3"] },
  },
  leavesById: {
    l1: { nodeId: "l1", name: "first", status: "passed", start: 1, flaky: true },
    l2: { nodeId: "l2", name: "second", status: "failed", start: 2, transition: "new" },
    l3: { nodeId: "l3", name: "third", status: "passed", start: 3, retry: true },
  },
} as unknown as ReportTree;

const leafNames = (store: ReturnType<typeof createTreeStore>) =>
  store.filtered.value.trees.flatMap((tree) => tree.leaves.map(({ name }) => name));

const createLoadedStore = async (id: Parameters<typeof createTreeStore>[0]["id"] = "behaviors") => {
  fetchReportJsonData.mockResolvedValue(treeData);

  const store = createTreeStore({ id, widgetFileName: `${id}.json`, csvFileName: `${id}.csv` });

  await store.fetchData();

  return store;
};

describe("createTreeStore", () => {
  it("loads the tree from its own widget file", async () => {
    await createLoadedStore("packages");

    expect(fetchReportJsonData).toHaveBeenCalledWith("widgets/packages.json", { bustCache: true });
  });

  it("applies query, status and flaky/retry/new filters to its own tree", async () => {
    const store = await createLoadedStore();

    store.setQuery("sec");
    expect(leafNames(store)).toEqual(["second"]);

    store.setQuery("");
    store.setStatus("passed");
    expect(leafNames(store)).toEqual(["first", "third"]);

    store.setStatus("total");
    store.setFilter("flaky", true);
    expect(leafNames(store)).toEqual(["first"]);

    store.setFilter("flaky", false);
    store.setFilter("retry", true);
    expect(leafNames(store)).toEqual(["third"]);

    store.setFilter("retry", false);
    store.setFilter("new", true);
    expect(leafNames(store)).toEqual(["second"]);
  });

  it("counts status tabs from its own tree, once per test result", async () => {
    const store = createTreeStore({ id: "categories", widgetFileName: "categories.json", csvFileName: "" });

    expect(store.stats.value).toBeUndefined();

    fetchReportJsonData.mockResolvedValue({
      root: { groups: ["product", "test"] },
      groupsById: {
        product: { nodeId: "product", name: "Product defects", leaves: ["l1", "l2"] },
        test: { nodeId: "test", name: "Test defects", leaves: ["l1", "l3"] },
      },
      leavesById: {
        l1: { nodeId: "l1", name: "first", status: "failed" },
        l2: { nodeId: "l2", name: "second", status: "failed" },
        l3: { nodeId: "l3", name: "third", status: "broken" },
      },
    });
    await store.fetchData();

    expect(store.stats.value).toEqual({ total: 3, failed: 2, broken: 1 });
  });

  it("keeps filters of different trees independent", async () => {
    const behaviors = await createLoadedStore("behaviors");
    const categories = await createLoadedStore("categories");

    behaviors.setQuery("first");

    expect(leafNames(behaviors)).toEqual(["first"]);
    expect(leafNames(categories)).toEqual(["first", "second", "third"]);
  });

  it("sorts leaves and persists the sort choice per tree", async () => {
    const store = await createLoadedStore("suites");

    store.setSortBy("alphabet");
    store.setDirection("desc");

    expect(leafNames(store)).toEqual(["third", "second", "first"]);
    expect(JSON.parse(localStorage.getItem(treeSortStorageKey("suites")))).toEqual({
      sortBy: "alphabet",
      direction: "desc",
    });

    const restored = createTreeStore({ id: "suites", widgetFileName: "tree.json", csvFileName: "suites.csv" });

    expect(restored.filters.value).toMatchObject({ sortBy: "alphabet", direction: "desc" });
    expect(createTreeStore({ id: "packages", widgetFileName: "", csvFileName: "" }).filters.value).toMatchObject({
      sortBy: "order",
      direction: "asc",
    });
  });

  it("ignores invalid persisted sort values", () => {
    localStorage.setItem(treeSortStorageKey("suites"), JSON.stringify({ sortBy: "nope", direction: "up" }));

    const store = createTreeStore({ id: "suites", widgetFileName: "tree.json", csvFileName: "suites.csv" });

    expect(store.filters.value).toMatchObject({ sortBy: "order", direction: "asc" });
  });

  it("clears filters but keeps the sort choice", async () => {
    const store = await createLoadedStore();

    store.setSortBy("duration");
    store.setQuery("first");
    store.setStatus("passed");
    store.setFilter("new", true);
    store.clearFilters();

    expect(store.filters.value).toEqual({
      query: "",
      status: "total",
      filter: { flaky: false, retry: false, new: false },
      sortBy: "duration",
      direction: "asc",
    });
  });

  it("bumps the expansion version on expand and collapse all", () => {
    const store = createTreeStore({ id: "suites", widgetFileName: "tree.json", csvFileName: "suites.csv" });

    store.collapseAll();
    expect(store.expansion.value).toEqual({ mode: "collapsed", version: 1 });

    store.expandAll();
    expect(store.expansion.value).toEqual({ mode: "expanded", version: 2 });
  });

  it("toggles and persists the groups info visibility", () => {
    const store = createTreeStore({ id: "behaviors", widgetFileName: "", csvFileName: "" });

    expect(store.showGroupsInfo.value).toBe(true);

    store.toggleGroupsInfo();

    expect(store.showGroupsInfo.value).toBe(false);
    expect(localStorage.getItem(treeGroupsInfoStorageKey("behaviors"))).toBe("false");
    expect(createTreeStore({ id: "behaviors", widgetFileName: "", csvFileName: "" }).showGroupsInfo.value).toBe(false);
  });
});
