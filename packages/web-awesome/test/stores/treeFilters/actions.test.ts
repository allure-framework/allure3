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

import { clearTreeFilterParams, fetchTreeFiltersData } from "../../../src/stores/treeFilters/actions.js";
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
      { key: "transition", value: [] },
      { key: "tags", value: [] },
      { key: "categories", value: [] },
      { key: "status", value: undefined },
    );
  });

  it("should reset filter params in a single URL update", () => {
    clearTreeFilterParams();

    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock.mock.calls[0]).toHaveLength(7);
  });
});
