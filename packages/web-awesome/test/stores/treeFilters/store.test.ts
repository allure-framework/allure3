import { buildFilterPredicate } from "@allurereport/web-commons";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-state");
  await story("tree-filters");
  await label("coverage", "ui-state");
});

const { getParamValueMock, getParamValuesMock, setParamsMock } = vi.hoisted(() => ({
  getParamValueMock: vi.fn(),
  getParamValuesMock: vi.fn(),
  setParamsMock: vi.fn(),
}));

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    getParamValue: getParamValueMock,
    getParamValues: getParamValuesMock,
    setParams: setParamsMock,
  };
});

const params = new Map<string, string>();

const setupStore = async (values: Record<string, string | undefined>) => {
  vi.resetModules();
  params.clear();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }

  getParamValueMock.mockImplementation((key: string) => params.get(key));
  getParamValuesMock.mockImplementation((key: string) => {
    const value = params.get(key);

    return value === undefined ? [] : [value];
  });
  setParamsMock.mockReset();

  return import("../../../src/stores/treeFilters/store.js");
};

describe("stores > treeFilters > store", () => {
  it("should expose known quick filter from URL params", async () => {
    const { treeQuickFilters } = await setupStore({ known: "true" });

    expect(treeQuickFilters.value).toContainEqual(
      expect.objectContaining({
        type: "field",
        value: {
          key: "known",
          type: "boolean",
          value: true,
        },
      }),
    );
  });

  it("should filter known leaves", async () => {
    const { treeNonQueryFilters } = await setupStore({ known: "true" });
    const predicate = buildFilterPredicate(treeNonQueryFilters.value);

    expect(predicate({ known: true })).toBe(true);
    expect(predicate({ known: false })).toBe(false);
  });

  it("should combine known and status filters with AND", async () => {
    const { treeNonQueryFilters } = await setupStore({ known: "true", status: "failed" });
    const predicate = buildFilterPredicate(treeNonQueryFilters.value);

    expect(predicate({ known: true, status: "failed" })).toBe(true);
    expect(predicate({ known: true, status: "passed" })).toBe(false);
    expect(predicate({ known: false, status: "failed" })).toBe(false);
  });

  it("should combine known, retry, and flaky marker filters with OR", async () => {
    const { treeNonQueryFilters } = await setupStore({
      flaky: "true",
      known: "true",
      retry: "true",
    });
    const predicate = buildFilterPredicate(treeNonQueryFilters.value);

    expect(predicate({ known: true, flaky: true, retry: true })).toBe(true);
    expect(predicate({ known: true, flaky: false, retry: false })).toBe(true);
    expect(predicate({ known: false, flaky: true, retry: false })).toBe(true);
    expect(predicate({ known: false, flaky: false, retry: true })).toBe(true);
    expect(predicate({ known: false, flaky: false, retry: false })).toBe(false);
  });

  it("should clear known filter", async () => {
    const { clearTreeFilters } = await setupStore({ known: "true" });

    clearTreeFilters();

    expect(setParamsMock).toHaveBeenCalledWith({
      key: "known",
      value: undefined,
    });
  });
});
