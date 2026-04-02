import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveUrlPathnameUnderServeRoot } from "../../src/utils.js";

describe("resolveUrlPathnameUnderServeRoot", () => {
  const root = resolve("/tmp/allure-static-serve-root");

  it("allows paths inside the root", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "/")).toBe(resolve(root));
    expect(resolveUrlPathnameUnderServeRoot(root, "/foo/bar")).toBe(resolve(root, "foo/bar"));
    expect(resolveUrlPathnameUnderServeRoot(root, "//nested//deep//file.txt")).toBe(
      resolve(root, "nested/deep/file.txt"),
    );
  });

  it("rejects traversal outside the root", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "/../../outside")).toBeNull();
    expect(resolveUrlPathnameUnderServeRoot(root, "/foo/../../../etc/passwd")).toBeNull();
  });

  it("rejects NUL in pathname", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "/a\0b")).toBeNull();
  });

  it("rejects path that lands in a sibling directory (prefix boundary)", () => {
    const narrowRoot = resolve("/tmp/allure-root-x");
    expect(resolveUrlPathnameUnderServeRoot(narrowRoot, "/../allure-root-xy/nested")).toBeNull();
  });

  it("rejects percent-encoded .. segments (decodeURI normalizes before resolve)", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(resolveUrlPathnameUnderServeRoot(root, "/safe/%2e%2e/%2e%2e/out")).toBeNull();
  });

  it("returns null on invalid URI encoding in pathname", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "/%")).toBeNull();
  });

  it("strips a leading backslash so the path stays relative to the root", () => {
    expect(resolveUrlPathnameUnderServeRoot(root, "\\foo")).toBe(resolve(root, "foo"));
  });

  it.skipIf(process.platform !== "win32")("rejects Windows absolute path in pathname on win32", () => {
    const winRoot = resolve("C:\\temp\\allure-serve");
    expect(resolveUrlPathnameUnderServeRoot(winRoot, "/D:/other/readme.txt")).toBeNull();
  });
});
