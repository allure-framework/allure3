import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "ALLURE_REPORT_SORT_BY";

beforeEach(async () => {
  await epic("coverage");
  await feature("sort");
  await story("treeSort");
  await label("coverage", "sort");
});

describe("stores > treeSort", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete (globalThis as any).allureReportOptions;
  });

  it("defaults to order,asc when no config and no localStorage value", async () => {
    const { sortBy } = await import("../../src/stores/treeSort.js");

    expect(sortBy.value).toBe("order,asc");
  });

  it("uses defaultSortBy from reportOptions when localStorage is empty", async () => {
    (globalThis as any).allureReportOptions = { defaultSortBy: "name,asc" };

    const { sortBy } = await import("../../src/stores/treeSort.js");

    expect(sortBy.value).toBe("name,asc");
  });

  it("is case-insensitive for defaultSortBy", async () => {
    (globalThis as any).allureReportOptions = { defaultSortBy: "Name,ASC" };

    const { sortBy } = await import("../../src/stores/treeSort.js");

    expect(sortBy.value).toBe("name,asc");
  });

  it("ignores invalid defaultSortBy and falls back to order,asc", async () => {
    (globalThis as any).allureReportOptions = { defaultSortBy: "invalid,value" };

    const { sortBy } = await import("../../src/stores/treeSort.js");

    expect(sortBy.value).toBe("order,asc");
  });

  it("localStorage takes priority over defaultSortBy from reportOptions", async () => {
    localStorage.setItem(STORAGE_KEY, "duration,desc");
    (globalThis as any).allureReportOptions = { defaultSortBy: "name,asc" };

    const { sortBy } = await import("../../src/stores/treeSort.js");

    expect(sortBy.value).toBe("duration,desc");
  });
});
