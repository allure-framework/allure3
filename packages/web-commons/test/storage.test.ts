import { afterEach, expect, it, vi } from "vite-plus/test";

import { loadFromLocalStorage } from "../src/storage.js";

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
