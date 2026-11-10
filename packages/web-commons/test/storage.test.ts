import { afterEach, expect, it, vi } from "vite-plus/test";

import { getReportStorageKey, getReportStorageScope, loadFromLocalStorage } from "../src/storage.js";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("restores JSON values and preserves fallback semantics", () => {
  expect(loadFromLocalStorage("missing", "fallback")).toBe("fallback");
  expect(loadFromLocalStorage("missing")).toBeUndefined();
  for (const [stored, expected] of [
    ["", "fallback"],
    ["broken", "fallback"],
    ['"value"', "value"],
    ["null", null],
    ["false", false],
    ["0", 0],
    ['["one"]', ["one"]],
  ] as const) {
    localStorage.setItem("key", stored);
    expect(loadFromLocalStorage<unknown>("key", "fallback")).toEqual(expected);
  }
});

it("returns the fallback when access to storage throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(loadFromLocalStorage("key", "fallback")).toBe("fallback");
});

it("scopes report state by the directory the report is served from", () => {
  for (const [pathname, expected] of [
    ["/", "/"],
    ["/index.html", "/"],
    ["/reports/1/", "/reports/1/"],
    ["/reports/1/index.html", "/reports/1/"],
    ["/Users/me/project/allure-report/index.html", "/Users/me/project/allure-report/"],
    ["C:/reports/index.html", "/C:/reports/"],
  ] as const) {
    expect(getReportStorageScope(pathname)).toBe(expected);
  }
});

it("gives reports in different directories of one origin different keys", () => {
  const first = getReportStorageKey("collapsedTrees", getReportStorageScope("/reports/1/index.html"));
  const second = getReportStorageKey("collapsedTrees", getReportStorageScope("/reports/2/index.html"));

  expect(first).toBe("allure-report:/reports/1/:collapsedTrees");
  expect(second).toBe("allure-report:/reports/2/:collapsedTrees");
});

it("keeps the key when a report is regenerated in the same directory", () => {
  expect(getReportStorageKey("collapsedTrees", getReportStorageScope("/latest/"))).toBe(
    getReportStorageKey("collapsedTrees", getReportStorageScope("/latest/index.html")),
  );
});

it("uses the current page location by default", () => {
  window.history.replaceState(null, "", "/project/report/index.html#/tree");
  try {
    expect(getReportStorageKey("expandedTrees")).toBe("allure-report:/project/report/:expandedTrees");
  } finally {
    window.history.replaceState(null, "", "/");
  }
});
