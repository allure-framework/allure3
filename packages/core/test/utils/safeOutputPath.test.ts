import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import { afterEach, describe, expect, it } from "vitest";

import { FileSystemReportFiles } from "../../src/plugin.js";
import {
  isPathContainedInDir,
  resolvePathUnderOutputRoot,
  UnsafeReportOutputPathError,
} from "../../src/utils/safeOutputPath.js";
import { isWindows } from "../../src/utils/windows.js";

describe("resolvePathUnderOutputRoot", () => {
  const root = resolve("/tmp/allure-output-test-root");

  it("resolves normal relative paths under root", () => {
    expect(resolvePathUnderOutputRoot(root, "widgets/a.json")).toBe(resolve(root, "widgets/a.json"));
  });

  it("rejects traversal via .. segments", () => {
    expect(() => resolvePathUnderOutputRoot(root, "../outside.txt")).toThrow(UnsafeReportOutputPathError);
  });

  it("rejects NUL in path", () => {
    expect(() => resolvePathUnderOutputRoot(root, "a\0b")).toThrow(UnsafeReportOutputPathError);
  });

  it("rejects absolute paths outside root", () => {
    expect(() => resolvePathUnderOutputRoot(root, "/etc/passwd")).toThrow(UnsafeReportOutputPathError);
  });

  it.skipIf(!isWindows())("rejects Windows absolute paths outside root on win32", () => {
    const winRoot = resolve("C:\\temp\\allure-out");
    expect(() => resolvePathUnderOutputRoot(winRoot, "D:\\other.txt")).toThrow(UnsafeReportOutputPathError);
  });
});

describe("FileSystemReportFiles", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("writes under output and refuses path traversal", async () => {
    outDir = await mkdtemp(join(tmpdir(), "allure-fs-report-"));
    const files = new FileSystemReportFiles(outDir);
    await files.addFile("ok.txt", Buffer.from("hi", "utf8"));
    expect(await readFile(join(outDir, "ok.txt"), "utf8")).toBe("hi");

    await expect(files.addFile("../evil.txt", Buffer.from("x"))).rejects.toThrow(UnsafeReportOutputPathError);
    await expect(files.addFile(join("..", "evil2.txt"), Buffer.from("x"))).rejects.toThrow(UnsafeReportOutputPathError);
  });

  it("rejects traversal from PluginFiles-style paths (pluginId + relative file key)", async () => {
    outDir = await mkdtemp(join(tmpdir(), "allure-fs-report-"));
    const files = new FileSystemReportFiles(outDir);
    const pluginStylePath = joinPosix("awesome", "../../outside.txt");

    await expect(files.addFile(pluginStylePath, Buffer.from("x"))).rejects.toThrow(UnsafeReportOutputPathError);
  });
});

describe("isPathContainedInDir", () => {
  it("does not treat a unrelated prefix as containment (prefix trap)", () => {
    const root = resolve("/tmp/allure-not-prefix");
    expect(isPathContainedInDir(root, resolve("/tmp/allure-not-prefix-evil/file"))).toBe(false);
  });
});
