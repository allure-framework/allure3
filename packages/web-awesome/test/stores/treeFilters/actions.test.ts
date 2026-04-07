import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchReportJsonDataMock, setParamsMock } = vi.hoisted(() => ({
  fetchReportJsonDataMock: vi.fn(),
  setParamsMock: vi.fn(),
}));

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    fetchReportJsonData: fetchReportJsonDataMock,
    setParams: setParamsMock,
  };
});

import { ReportFetchError } from "@allurereport/web-commons";

import { fetchTreeFiltersData } from "../../../src/stores/treeFilters/actions.js";
import { treeCategories, treeTags } from "../../../src/stores/treeFilters/store.js";

describe("stores > treeFilters > actions", () => {
  beforeEach(() => {
    treeTags.value = [];
    treeCategories.value = [];
    fetchReportJsonDataMock.mockReset();
    setParamsMock.mockReset();
  });

  afterEach(() => {
    treeTags.value = [];
    treeCategories.value = [];
    vi.restoreAllMocks();
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
    expect(consoleErrorSpy).not.toHaveBeenCalled();
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
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to fetch tree filters data:\n\n", error);
  });
});
