import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-state");
  await story("actions");
  await label("coverage", "ui-state");
});

const { fetchReportJsonDataMock, setParamsMock } = vi.hoisted(() => ({
  fetchReportJsonDataMock: vi.fn(),
  setParamsMock: vi.fn(),
}));

const treeFiltersErrorMessage = "Failed to fetch tree filters data:\n\n";

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    fetchReportJsonData: fetchReportJsonDataMock,
    setParams: setParamsMock,
  };
});

import { ReportFetchError } from "@allurereport/web-commons";

import {
  clearTreeFilterParams,
  fetchTreeFiltersData,
  setQueryFilter,
  setSeverityFilter,
} from "../../../src/stores/treeFilters/actions.js";
import { clearTreeFilters } from "../../../src/stores/treeFilters/store.js";
import { treeCategories, treeFiltersResetNonce, treeTags } from "../../../src/stores/treeFilters/store.js";

describe("stores > treeFilters > actions", () => {
  beforeEach(() => {
    treeTags.value = [];
    treeCategories.value = [];
    treeFiltersResetNonce.value = 0;
    fetchReportJsonDataMock.mockReset();
    setParamsMock.mockReset();
  });

  afterEach(() => {
    treeTags.value = [];
    treeCategories.value = [];
    treeFiltersResetNonce.value = 0;
    vi.restoreAllMocks();
  });

  describe("tree body height while filtering", () => {
    const mountTree = (scrollTop: number) => {
      document.body.innerHTML = `
        <div data-tree-scroll-container>
          <section>
            <header data-tree-sticky-header></header>
            <div data-tree-body></div>
          </section>
        </div>
      `;

      const container = document.querySelector("[data-tree-scroll-container]") as HTMLElement;
      const section = document.querySelector("section") as HTMLElement;
      const body = document.querySelector("[data-tree-body]") as HTMLElement;
      const containerTop = 0;
      const sectionTopInContent = 300;
      const headerHeight = 60;

      Object.defineProperty(container, "clientHeight", { value: 500 });
      container.scrollTop = scrollTop;
      container.getBoundingClientRect = () => ({ top: containerTop }) as DOMRect;
      section.getBoundingClientRect = () => ({ top: containerTop + sectionTopInContent - scrollTop }) as DOMRect;
      body.getBoundingClientRect = () =>
        ({ top: containerTop + sectionTopInContent + headerHeight - scrollTop }) as DOMRect;

      return body;
    };

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("should keep the body tall enough to hold the scroll position once the header is scrolled away", () => {
      const body = mountTree(800);

      setQueryFilter("abc");

      expect(body.style.minHeight).toBe("940px");
    });

    it("should not touch the body height while the header is still visible", () => {
      const body = mountTree(100);

      setQueryFilter("abc");

      expect(body.style.minHeight).toBe("");
    });
  });

  it("should fall back to empty filters on 404 without logging an error", async () => {
    treeTags.value = ["seed-tag"];
    treeCategories.value = ["seed-category"];

    fetchReportJsonDataMock.mockRejectedValue(
      new ReportFetchError("missing tree filters", new Response(null, { status: 404, statusText: "Not Found" })),
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await fetchTreeFiltersData();

    expect(treeTags.value).toEqual([]);
    expect(treeCategories.value).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(treeFiltersErrorMessage, expect.anything());
  });

  it("should populate filters from fetched data", async () => {
    fetchReportJsonDataMock.mockResolvedValue({
      tags: ["smoke"],
      categories: ["Product Bug"],
    });

    await fetchTreeFiltersData();

    expect(treeTags.value).toEqual(["smoke"]);
    expect(treeCategories.value).toEqual(["Product Bug"]);
  });

  it("should log unexpected errors without overwriting existing filters", async () => {
    treeTags.value = ["seed-tag"];
    treeCategories.value = ["seed-category"];

    const error = new Error("boom");
    fetchReportJsonDataMock.mockRejectedValue(error);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await fetchTreeFiltersData();

    expect(treeTags.value).toEqual(["seed-tag"]);
    expect(treeCategories.value).toEqual(["seed-category"]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(treeFiltersErrorMessage, error);
  });

  it("should reset all filter params when clearing tree filters", () => {
    clearTreeFilters();

    expect(treeFiltersResetNonce.value).toBe(1);
    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock).toHaveBeenCalledWith(
      { key: "query", value: undefined },
      { key: "retry", value: undefined },
      { key: "flaky", value: undefined },
      { key: "resolution", value: [] },
      { key: "transition", value: [] },
      { key: "tags", value: [] },
      { key: "categories", value: [] },
      { key: "severity", value: [] },
      { key: "status", value: undefined },
    );
  });

  it("should write severity values to the url as a repeated param", () => {
    setSeverityFilter(["blocker", "none"]);

    expect(setParamsMock).toHaveBeenCalledWith({ key: "severity", value: ["blocker", "none"] });
  });

  it("should clear the severity param when no severity is selected", () => {
    setSeverityFilter([]);

    expect(setParamsMock).toHaveBeenCalledWith({ key: "severity", value: [] });
  });

  it("should reset filter params in a single URL update", () => {
    clearTreeFilterParams();

    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock.mock.calls[0]).toHaveLength(9);
  });
});
