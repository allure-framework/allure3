import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveDumpAttachmentPath, UnsafeDumpPathError } from "../../src/utils/safeDumpPath.js";

describe("resolveDumpAttachmentPath", () => {
  const root = resolve("/tmp/allure-dump-test-root");

  it("allows a single-segment name", () => {
    expect(resolveDumpAttachmentPath(root, "abc-123")).toBe(resolve(root, "abc-123"));
  });

  it("allows nested paths under root", () => {
    expect(resolveDumpAttachmentPath(root, "a/b/c.bin")).toBe(resolve(root, "a/b/c.bin"));
  });

  it("rejects empty entry name", () => {
    expect(() => resolveDumpAttachmentPath(root, "")).toThrow(UnsafeDumpPathError);
  });

  it("rejects NUL in entry name", () => {
    expect(() => resolveDumpAttachmentPath(root, "a\0b")).toThrow(UnsafeDumpPathError);
  });

  it("rejects parent segments (zip-slip)", () => {
    expect(() => resolveDumpAttachmentPath(root, "../../etc/passwd")).toThrow(UnsafeDumpPathError);
  });

  it("rejects a single .. segment", () => {
    expect(() => resolveDumpAttachmentPath(root, "..")).toThrow(UnsafeDumpPathError);
  });

  it("rejects nested names that normalize outside the root", () => {
    expect(() => resolveDumpAttachmentPath(root, "a/b/../../../outside")).toThrow(UnsafeDumpPathError);
  });

  it("rejects POSIX-style absolute entry paths", () => {
    expect(() => resolveDumpAttachmentPath(root, "/etc/passwd")).toThrow(UnsafeDumpPathError);
  });

  it.skipIf(process.platform !== "win32")("rejects Windows-style absolute entry names", () => {
    const winRoot = resolve("C:\\temp\\allure-dump-root");
    expect(() => resolveDumpAttachmentPath(winRoot, "C:\\Windows\\evil.txt")).toThrow(UnsafeDumpPathError);
    expect(() => resolveDumpAttachmentPath(winRoot, "D:\\other-drive.txt")).toThrow(UnsafeDumpPathError);
  });
});
